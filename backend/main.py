import json
import os
import uuid
from pathlib import Path
from typing import Literal
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel, Field
from db import ROOT, db, init, rows
load_dotenv(ROOT / '.env')
from agents import stream_chat, search

app=FastAPI(title='农助 AI',version='1.0.0')
init()
from garden import router as garden_router, init_garden
init_garden()
app.include_router(garden_router)
from capabilities import router as capabilities_router
app.include_router(capabilities_router)

class Plot(BaseModel):
    name: str=Field(min_length=1,max_length=80)
    crop: str=Field(min_length=1,max_length=80)
    region: str=Field(min_length=1,max_length=100)
    area: float=Field(gt=0,le=1000000)
    planted: str
    stage: Literal['待播种','幼苗期','生长期','开花期','抽穗期','灌浆期','成熟期']
    status: Literal['健康','需关注','待收获']='健康'
    notes: str=Field(default='',max_length=4000)
    simulated: bool=False

class Task(BaseModel):
    plot_id: int
    title: str=Field(min_length=1,max_length=6000)
    due: str
    kind: str='农事任务'

class Chat(BaseModel):
    message: str=Field(min_length=1,max_length=12000)
    conversation_id: str | None=None
    plot_id: int | None=None
    agent: Literal['planting','risk','industry'] | None=None
    attachment_id: str | None=None
    consent: bool=False

def exists(plot_id):
    if not rows('SELECT id FROM plots WHERE id=?',(plot_id,)): raise HTTPException(404,'地块不存在')

@app.get('/api/health')
def health():
    return {'status':'ok','database':'SQLite','ai_configured':bool(os.getenv('DEEPSEEK_API_KEY')),'model':os.getenv('DEEPSEEK_MODEL','deepseek-chat'),'vision_configured':all(os.getenv(k) for k in ['VISION_API_KEY','VISION_BASE_URL','VISION_MODEL']),'weather':'Open-Meteo 外部气象模型，可查询','market':'网页来源检索，报价需核验','video_frames':True}

@app.get('/api/plots')
def plots(): return rows('SELECT * FROM plots ORDER BY id')

@app.post('/api/plots')
def create_plot(p:Plot):
    from datetime import date
    try: date.fromisoformat(p.planted)
    except ValueError: raise HTTPException(422,'种植日期格式错误')
    with db() as c:
        keys=list(p.model_dump())
        cur=c.execute(f'INSERT INTO plots({",".join(keys)}) VALUES({",".join("?" for _ in keys)})',tuple(p.model_dump().values()))
        return {'id':cur.lastrowid}

@app.put('/api/plots/{pid}')
def update_plot(pid:int,p:Plot):
    exists(pid)
    from datetime import date
    try: date.fromisoformat(p.planted)
    except ValueError: raise HTTPException(422,'种植日期格式错误')
    with db() as c: c.execute('UPDATE plots SET '+','.join(k+'=?' for k in p.model_dump())+' WHERE id=?',(*p.model_dump().values(),pid))
    return {'ok':True}

@app.get('/api/tasks')
def tasks(plot_id:int | None=None):
    return rows('SELECT tasks.*,plots.name AS plot_name FROM tasks JOIN plots ON tasks.plot_id=plots.id'+(' WHERE plot_id=?' if plot_id else '')+' ORDER BY done,due',(plot_id,) if plot_id else ())

@app.post('/api/tasks')
def create_task(t:Task):
    from datetime import date
    exists(t.plot_id)
    try: date.fromisoformat(t.due)
    except ValueError: raise HTTPException(422,'任务日期格式错误')
    with db() as c:
        cur=c.execute('INSERT INTO tasks(plot_id,title,due,kind) VALUES(?,?,?,?)',(t.plot_id,t.title,t.due,t.kind))
    return {'id':cur.lastrowid}

class TaskUpdate(BaseModel):
    done: bool

@app.patch('/api/tasks/{tid}')
def complete(tid:int,body:TaskUpdate):
    with db() as c:
        cur=c.execute('UPDATE tasks SET done=? WHERE id=?',(body.done,tid))
        if not cur.rowcount: raise HTTPException(404,'任务不存在')
    return {'ok':True}

@app.post('/api/chat')
async def chat(req:Chat):
    if req.plot_id: exists(req.plot_id)
    if req.conversation_id and not rows('SELECT id FROM conversations WHERE id=?',(req.conversation_id,)): raise HTTPException(404,'对话不存在')
    if req.conversation_id:
        existing=rows('SELECT agent FROM conversations WHERE id=?',(req.conversation_id,))[0]
        if existing['agent']!=(req.agent or 'general'): raise HTTPException(409,'请在对应专业栏目新建对话，不能混用不同专业的历史')
    async def events():
        async for event in stream_chat(req): yield 'data: '+json.dumps(event,ensure_ascii=False)+'\n\n'
    return StreamingResponse(events(),media_type='text/event-stream',headers={'Cache-Control':'no-cache','X-Accel-Buffering':'no'})

@app.get('/api/conversations')
def conversations(agent:str | None=None):
    return rows('SELECT * FROM conversations'+(' WHERE agent=?' if agent else '')+' ORDER BY created DESC',(agent,) if agent else ())

@app.get('/api/conversations/{cid}')
def messages(cid:str): return rows('SELECT * FROM messages WHERE conversation_id=? ORDER BY id',(cid,))

@app.delete('/api/conversations/{cid}')
def delete_conversation(cid:str):
    with db() as c:
        c.execute('DELETE FROM runs WHERE conversation_id=?',(cid,))
        c.execute('DELETE FROM conversations WHERE id=?',(cid,))
    return {'ok':True}

@app.get('/api/runs')
def runs(plot_id:int | None=None): return rows('SELECT * FROM runs'+(' WHERE plot_id=?' if plot_id else '')+' ORDER BY created DESC LIMIT 100',(plot_id,) if plot_id else ())

class Feedback(BaseModel):
    message_id:int
    rating:Literal[-1,1]
    comment:str=Field(default='',max_length=2000)

@app.post('/api/feedback')
def feedback(f:Feedback):
    if not rows("SELECT id FROM messages WHERE id=? AND role='assistant'",(f.message_id,)): raise HTTPException(404,'回答不存在')
    with db() as c: c.execute('INSERT INTO feedback(message_id,rating,comment) VALUES(?,?,?)',(f.message_id,f.rating,f.comment))
    return {'ok':True}

@app.get('/api/knowledge')
def knowledge(): return rows('SELECT * FROM documents ORDER BY created DESC')

@app.get('/api/knowledge/search')
def lookup(q:str): return search(q)

@app.delete('/api/knowledge/{did}')
def delete_document(did:str):
    with db() as c:
        c.execute('DELETE FROM chunks WHERE document_id=?',(did,))
        c.execute('DELETE FROM documents WHERE id=?',(did,))
    for path in (ROOT/'knowledge').glob(did+'.*'): path.unlink()
    return {'ok':True}

@app.post('/api/knowledge')
async def import_document(file:UploadFile=File(...),category:str=Form('农业技术推广'),source:str=Form('用户本地导入，来源待核验')):
    suffix=Path(file.filename or '').suffix.lower()
    if suffix not in ['.pdf','.docx','.txt','.md','.json']: raise HTTPException(415,'支持 PDF、DOCX、TXT、Markdown、JSON')
    content=await file.read(15*1024*1024+1)
    if len(content)>15*1024*1024: raise HTTPException(413,'知识文件不能超过 15 MB')
    import io
    try:
        if suffix=='.pdf':
            from pypdf import PdfReader
            text='\n'.join(page.extract_text() or '' for page in PdfReader(io.BytesIO(content)).pages)
        elif suffix=='.docx':
            from docx import Document
            doc=Document(io.BytesIO(content))
            text='\n'.join([p.text for p in doc.paragraphs]+[cell.text for table in doc.tables for row in table.rows for cell in row.cells])
        else: text=content.decode('utf-8-sig')
        if suffix=='.json': text=json.dumps(json.loads(text),ensure_ascii=False)
        if not text.strip(): raise ValueError('没有可提取文字，扫描件需要先 OCR')
    except Exception as e: raise HTTPException(422,'文件解析失败，扫描件请先 OCR，文本文件请保存为 UTF-8') from e
    did=uuid.uuid4().hex
    (ROOT/'knowledge').mkdir(exist_ok=True)
    (ROOT/'knowledge'/f'{did}{suffix}').write_bytes(content)
    with db() as c:
        c.execute('INSERT INTO documents(id,name,category,source) VALUES(?,?,?,?)',(did,Path(file.filename).name,category[:100],source[:2000]))
        c.executemany('INSERT INTO chunks(document_id,content) VALUES(?,?)',[(did,text[i:i+900]) for i in range(0,len(text),750)])
    return {'id':did,'characters':len(text)}

@app.post('/api/uploads')
async def upload(file:UploadFile=File(...)):
    mime=file.content_type or ''
    if mime not in ['image/jpeg','image/png','image/webp','video/mp4','video/webm']: raise HTTPException(415,'只支持 JPG、PNG、WEBP、MP4、WEBM')
    limit=8*1024*1024 if mime.startswith('image/') else 30*1024*1024
    content=await file.read(limit+1)
    if len(content)>limit: raise HTTPException(413,'图片上限 8 MB，视频上限 30 MB')
    valid=(mime=='image/jpeg' and content.startswith(b'\xff\xd8\xff')) or (mime=='image/png' and content.startswith(b'\x89PNG\r\n\x1a\n')) or (mime=='image/webp' and content[:4]==b'RIFF' and content[8:12]==b'WEBP') or (mime=='video/mp4' and content[4:8]==b'ftyp') or (mime=='video/webm' and content[:4]==b'\x1aE\xdf\xa3')
    if not valid: raise HTTPException(415,'文件内容与声明格式不一致')
    uid=uuid.uuid4().hex
    folder=ROOT/'data'/'uploads'
    folder.mkdir(parents=True,exist_ok=True)
    path=folder/uid
    path.write_bytes(content)
    with db() as c: c.execute('INSERT INTO uploads(id,name,mime,path) VALUES(?,?,?,?)',(uid,Path(file.filename or '附件').name,mime,str(path)))
    return {'id':uid,'name':Path(file.filename or '附件').name,'mime':mime,'notice':'文件仅保存在本地。视频可提取关键帧；发送视觉模型前需明确授权。' if mime.startswith('video') else '文件仅保存在本地，发送视觉模型前需明确授权。'}


@app.get('/api/uploads/{uid}/frames')
async def video_frames(uid:str):
    import asyncio, base64
    from capabilities import extract_frames
    found=rows('SELECT * FROM uploads WHERE id=?',(uid,))
    if not found or not found[0]['mime'].startswith('video/'):
        raise HTTPException(404,'未找到视频')
    try:
        frames=await asyncio.to_thread(extract_frames,found[0]['path'])
        return {'frames':[{'seconds':f['seconds'],'url':'data:image/jpeg;base64,'+base64.b64encode(f['bytes']).decode()} for f in frames],'notice':'本机提取三个时间位置的抽样画面，不代表完整视频理解。'}
    except Exception as e: raise HTTPException(422,'视频画面提取失败，请使用 10 分钟内的常见 MP4/WebM 视频。') from e


@app.get('/api/media/li-baoguo')
def li_baoguo_video():
    path=ROOT/'data'/'media'/'li-baoguo.mp4'
    if not path.is_file(): raise HTTPException(404,'李保国视频暂不可用，请重新导入')
    return FileResponse(path,media_type='video/mp4',filename='li-baoguo.mp4',content_disposition_type='inline')


@app.get('/api/media/crops/{crop_id}')
def crop_image(crop_id:str):
    from crop_media import NAMES
    if crop_id not in {f'{i+1:02d}' for i in range(len(NAMES))}:raise HTTPException(404,'未找到作物图片')
    path=ROOT/'data'/'media'/'crops'/(crop_id+'.jpg')
    if not path.is_file():raise HTTPException(404,'图片文件暂不可用')
    return FileResponse(path,media_type='image/jpeg',filename=crop_id+'.jpg',content_disposition_type='inline')
