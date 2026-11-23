import json
import os
import tempfile
from pathlib import Path
import pytest

# Isolated DB and uploads; never modify the actual user's project data.
TEST_ROOT=Path(tempfile.mkdtemp(prefix='nongzhu-tests-'))
os.environ['NONGZHU_DB']=str(TEST_ROOT/'test.db')
from fastapi.testclient import TestClient
import main
import agents
from db import rows
client=TestClient(main.app)
main.ROOT=TEST_ROOT

def test_health_and_seed():
    assert client.get('/api/health').json()['database']=='SQLite'
    plots=client.get('/api/plots').json()
    assert len(plots)>=6 and plots[0]['simulated']==1

def test_plot_and_task_persist():
    data={'name':'测试田','crop':'番茄','region':'浙江','area':1.2,'planted':'2026-11-14','stage':'幼苗期','status':'健康','simulated':False}
    pid=client.post('/api/plots',json=data).json()['id']
    data['stage']='生长期'
    assert client.put(f'/api/plots/{pid}',json=data).status_code==200
    assert rows('SELECT stage FROM plots WHERE id=?',(pid,))[0]['stage']=='生长期'
    tid=client.post('/api/tasks',json={'plot_id':pid,'title':'巡田','due':'2026-11-15'}).json()['id']
    assert client.patch(f'/api/tasks/{tid}',json={'done':True}).status_code==200
    assert next(t for t in client.get('/api/tasks').json() if t['id']==tid)['done']==1
    assert client.post('/api/tasks',json={'plot_id':pid,'title':'无效日期','due':'bad'}).status_code==422
    assert client.put('/api/plots/99999',json=data).status_code==404

def test_reclaimed_plot_persists_and_can_be_planted():
    data={'name':'新开垦模拟田','crop':'待播种','region':'模拟农场','area':1,'planted':'2026-11-14','stage':'待播种','status':'健康','simulated':True}
    response=client.post('/api/plots',json=data)
    assert response.status_code==200,response.text
    pid=response.json()['id']
    saved=next(p for p in client.get('/api/plots').json() if p['id']==pid)
    assert saved['crop']=='待播种' and saved['stage']=='待播种' and saved['simulated']==1
    data.update(crop='玉米',stage='幼苗期')
    assert client.put(f'/api/plots/{pid}',json=data).status_code==200
    assert rows('SELECT crop,stage FROM plots WHERE id=?',(pid,))[0]=={'crop':'玉米','stage':'幼苗期'}


def test_garden_simulation_shared_snapshot():
    before=client.get('/api/garden').json()
    original=before['simulation']['weather']
    try:
        assert client.patch('/api/garden/simulation',json={'weather':'snow','plot_id':-1,'kind':'insects','severity':70}).status_code==200
        assert client.patch('/api/garden/simulation',json={'plot_id':-2,'kind':'disease','severity':35}).status_code==200
        snapshot=client.get('/api/garden').json()
        assert snapshot['simulation']['weather']=='snow'
        assert {'plotId':-1,'kind':'insects','severity':70} in snapshot['simulation']['pests']
        assert {'plotId':-2,'kind':'disease','severity':35} in snapshot['simulation']['pests']
        assert snapshot['slots'][0]['crop']==before['slots'][0]['crop']
        assert client.patch('/api/garden/simulation',json={'plot_id':-1,'kind':'clear'}).status_code==200
        assert not any(p['plotId']==-1 for p in client.get('/api/garden').json()['simulation']['pests'])
        assert client.patch('/api/garden/simulation',json={'plot_id':-999,'kind':'insects'}).status_code==404
        assert client.patch('/api/garden/simulation',json={'weather':'invalid'}).status_code==422
        assert client.patch('/api/garden/simulation',json={'plot_id':-2,'kind':'disease','severity':200}).status_code==422
    finally:
        client.patch('/api/garden/simulation',json={'weather':original,'plot_id':-2,'kind':'clear'})


def test_routing():
    assert agents.route('小麦种植计划')==['planting']
    assert agents.route('病虫害异常')==['risk']
    assert agents.route('销售和政策补贴')==['industry']
    assert agents.route('小麦长势不好，病虫害风险和销售')==['planting','risk','industry']
    assert agents.route('普通问题', 'risk')==['risk']


def test_public_tools_validation_and_results(monkeypatch):
    import capabilities
    async def fake_search(query):
        return [{'name':'农业资料','source':'https://example.org/notice','content':'待核验摘要'}]
    monkeypatch.setattr(capabilities,'web_search',fake_search)
    assert client.get('/api/tools/search',params={'q':'农业政策'}).json()['results'][0]['source']=='https://example.org/notice'
    assert client.get('/api/tools/search',params={'q':'a'}).status_code==422
    assert client.get('/api/tools/weather/forecast',params={'latitude':91,'longitude':120}).status_code==422
    assert client.get('/api/uploads/nonexistent/frames').status_code==404


def test_video_keyframes():
    import cv2
    import numpy as np
    from capabilities import extract_frames
    path=TEST_ROOT/'test-video.mp4'
    writer=cv2.VideoWriter(str(path),cv2.VideoWriter_fourcc(*'mp4v'),10,(64,64))
    assert writer.isOpened()
    for value in range(30): writer.write(np.full((64,64,3),value*7,dtype=np.uint8))
    writer.release()
    frames=extract_frames(path)
    assert len(frames)==3
    assert frames[0]['seconds']<frames[1]['seconds']<frames[2]['seconds']
    assert all(f['bytes'].startswith(b'\xff\xd8') for f in frames)

def test_knowledge_import_search_delete():
    res=client.post('/api/knowledge',files={'file':('农业资料.txt','水稻生长管理需要定期观察。叶片发黄需要结合实地情况分析。'.encode(),'text/plain')},data={'source':'本地测试资料','category':'粮食作物'})
    assert res.status_code==200,res.text
    found=client.get('/api/knowledge/search',params={'q':'叶片发黄'}).json()
    assert found and found[0]['source']=='本地测试资料'
    assert client.delete('/api/knowledge/'+res.json()['id']).status_code==200
    assert not client.get('/api/knowledge/search',params={'q':'叶片发黄'}).json()
    assert client.post('/api/knowledge',files={'file':('empty.txt',b'','text/plain')}).status_code==422

def test_upload_validation():
    assert client.post('/api/uploads',files={'file':('test.exe',b'bad','application/octet-stream')}).status_code==415
    assert client.post('/api/uploads',files={'file':('fake.png',b'fake','image/png')}).status_code==415
    res=client.post('/api/uploads',files={'file':('small.png',b'\x89PNG\r\n\x1a\n'+b'0'*32,'image/png')})
    assert res.status_code==200
    assert client.post('/api/uploads',files={'file':('large.png',b'0'*(8*1024*1024+1),'image/png')}).status_code==413

def test_missing_key_error_and_history(monkeypatch):
    monkeypatch.delenv('DEEPSEEK_API_KEY',raising=False)
    events=[json.loads(s[6:]) for s in client.post('/api/chat',json={'message':'如何种植水稻'}).text.split('\n\n') if s.startswith('data: ')]
    assert events[1]['type']=='error'
    cid=events[0]['id']
    assert client.get('/api/conversations/'+cid).json()[0]['content']=='如何种植水稻'
    assert client.delete('/api/conversations/'+cid).status_code==200
    assert not client.get('/api/conversations/'+cid).json()

def test_orchestration_with_stub_transport(monkeypatch):
    # Transport stub verifies workflow only; this is not a live DeepSeek acceptance test.
    from types import SimpleNamespace as NS
    calls=[]
    class Fake:
        def __init__(self,**kwargs): self.chat=NS(completions=self)
        async def close(self): pass
        async def create(self,**kwargs):
            calls.append(kwargs)
            if kwargs.get('stream'):
                async def chunks():
                    for content in ['综合','建议']:
                        yield NS(choices=[NS(delta=NS(content=content))])
                return chunks()
            return NS(choices=[NS(message=NS(content=json.dumps({'summary':'测试分析','questions':['地区？']})))])
    monkeypatch.setenv('DEEPSEEK_API_KEY','test-placeholder')
    monkeypatch.setattr(agents,'AsyncOpenAI',Fake)
    res=client.post('/api/chat',json={'message':'种植长势不好，叶片发黄和销售','plot_id':1})
    events=[json.loads(s[6:]) for s in res.text.split('\n\n') if s.startswith('data: ')]
    assert len(calls)==4 # Three specialists plus one synthesis, no duplicate routing model calls.
    assert [e['text'] for e in events if e['type']=='delta']==['综合','建议']
    assert len([e for e in events if e['type']=='agent' and e['status']=='completed'])==3
    cid=events[0]['id']
    assert client.get('/api/conversations/'+cid).json()[-1]['content']=='综合建议'
    assert len([r for r in client.get('/api/runs?plot_id=1').json() if r['conversation_id']==cid])==3
    mid=events[-1]['message_id']
    assert client.post('/api/feedback',json={'message_id':mid,'rating':1}).status_code==200

def test_provider_failure_and_logs(monkeypatch):
    from types import SimpleNamespace as NS
    class Failure:
        def __init__(self,**kw): self.chat=NS(completions=self)
        async def close(self): pass
        async def create(self,**kw): raise RuntimeError('Simulated provider outage')
    monkeypatch.setenv('DEEPSEEK_API_KEY','test-placeholder')
    monkeypatch.setattr(agents,'AsyncOpenAI',Failure)
    res=client.post('/api/chat',json={'message':'病虫害异常','plot_id':2})
    events=[json.loads(s[6:]) for s in res.text.split('\n\n') if s.startswith('data: ')]
    assert any(e['type']=='error' for e in events)
    assert any(e['type']=='agent' and e['status']=='failed' for e in events)
    cid=events[0]['id']
    assert rows('SELECT status FROM runs WHERE conversation_id=?',(cid,))[0]['status']=='failed'

def test_document_formats():
    import io
    from docx import Document
    doc=Document();doc.add_paragraph('番茄种植观察记录。')
    stream=io.BytesIO();doc.save(stream)
    result=client.post('/api/knowledge',files={'file':('tomato.docx',stream.getvalue(),'application/vnd.openxmlformats-officedocument.wordprocessingml.document')})
    assert result.status_code==200
    assert client.post('/api/knowledge',files={'file':('notes.json','{"说明":"土壤管理资料"}'.encode(),'application/json')}).status_code==200
    assert client.post('/api/knowledge',files={'file':('notes.md','土壤管理观察。'.encode(),'text/markdown')}).status_code==200
    assert client.post('/api/knowledge',files={'file':('bad.pdf',b'not pdf','application/pdf')}).status_code==422

def test_interactive_garden(monkeypatch):
    import garden
    clock=[1000.0]
    monkeypatch.setattr(garden.time,'time',lambda:clock[0])
    state=client.get('/api/garden').json()
    assert len(state['slots'])==16 and len(state['crops'])==5
    original=client.get('/api/plots').json()
    state=client.post('/api/garden/1',json={'action':'plant','crop':'番茄'}).json()
    assert state['slots'][0]['crop']=='番茄'
    assert client.post('/api/garden/1',json={'action':'plant','crop':'玉米'}).status_code==409
    assert client.post('/api/garden/1',json={'action':'harvest'}).status_code==409
    clock[0]+=60
    state=client.get('/api/garden').json();slot=state['slots'][0]
    assert 22<slot['progress']<23 and 62<slot['water']<63
    slot=client.post('/api/garden/1',json={'action':'water'}).json()['slots'][0]
    assert slot['water']>97
    clock[0]+=240
    state=client.get('/api/garden').json()
    assert state['slots'][0]['progress']==100
    slot=client.post('/api/garden/1',json={'action':'harvest'}).json()['slots'][0]
    assert slot['crop'] is None and slot['harvests']==1
    assert client.post('/api/garden/1',json={'action':'harvest'}).status_code==409
    assert client.get('/api/plots').json()==original
    assert rows('SELECT harvests FROM garden_slots WHERE id=1')[0]['harvests']==1
    assert client.post('/api/garden/99',json={'action':'water'}).status_code==404
    assert client.post('/api/garden/2',json={'action':'plant','crop':'不存在'}).status_code==422

def test_garden_water_exhaustion(monkeypatch):
    import garden
    clock=[2000.0]
    monkeypatch.setattr(garden.time,'time',lambda:clock[0])
    client.post('/api/garden/2',json={'action':'plant','crop':'南瓜'})
    from db import db
    with db() as c:c.execute('UPDATE garden_slots SET water=11 WHERE id=2')
    clock[0]+=10000
    slot=client.get('/api/garden').json()['slots'][1]
    assert 2<slot['progress']<3 and slot['water']==0
    # Polling again does not invent growth while dry.
    clock[0]+=100
    assert client.get('/api/garden').json()['slots'][1]['progress']==slot['progress']
    client.post('/api/garden/2',json={'action':'water'})
    clock[0]+=30
    assert client.get('/api/garden').json()['slots'][1]['progress']>slot['progress']

def test_specialist_knowledge_and_history_isolation(monkeypatch):
    from db import db
    import uuid
    for category in ['农业政策','病虫害基础','作物生长管理']:
        client.post('/api/knowledge',files={'file':('专属.txt','测试专属知识资料用于分类检索。'.encode(),'text/plain')},data={'category':category,'source':category})
    assert {r['source'] for r in agents.search('测试专属知识','planting')}=={'作物生长管理'}
    assert {r['source'] for r in agents.search('测试专属知识','risk')}=={'病虫害基础'}
    assert {r['source'] for r in agents.search('测试专属知识','industry')}=={'农业政策'}
    cid=uuid.uuid4().hex
    with db() as c:c.execute('INSERT INTO conversations(id,title,agent) VALUES(?,?,?)',(cid,'风险专属测试','risk'))
    assert cid in [r['id'] for r in client.get('/api/conversations?agent=risk').json()]
    assert cid not in [r['id'] for r in client.get('/api/conversations?agent=planting').json()]
    assert client.post('/api/chat',json={'message':'种植计划','conversation_id':cid,'agent':'planting'}).status_code==409

def test_specialist_prompts_enforce_scope(monkeypatch):
    from types import SimpleNamespace as NS
    calls=[]
    class Fake:
        def __init__(self,**kw):self.chat=NS(completions=self)
        async def close(self):pass
        async def create(self,**kw):
            calls.append(kw)
            if kw.get('stream'):
                async def chunks():yield NS(choices=[NS(delta=NS(content='此处仅回答病虫害与风险问题，请前往产业助农。'))])
                return chunks()
            return NS(choices=[NS(message=NS(content='{"out_of_scope":true,"summary":"请前往产业助农","questions":[]}'))])
    monkeypatch.setenv('DEEPSEEK_API_KEY','test-placeholder')
    monkeypatch.setattr(agents,'AsyncOpenAI',Fake)
    res=client.post('/api/chat',json={'message':'请给我写销售文案','agent':'risk'})
    assert '产业助农' in res.text
    assert len(calls)==2
    assert '超范围' in calls[0]['messages'][0]['content']
    assert '只转述拒答' in calls[1]['messages'][0]['content']


def test_environment_random_clock_and_manual_override(monkeypatch):
    import garden
    clock=[5000.0]
    monkeypatch.setattr(garden.time,'time',lambda:clock[0])
    choices=[]
    def choose(options):
        choices.append(1)
        return ('hot','sunny','drought') if len(choices)==1 else ('humid','rain','flood')
    monkeypatch.setattr(garden.random,'choice',choose)
    try:
        state=client.patch('/api/garden/simulation',json={'climate':'cold','disaster':'hail'}).json()['simulation']
        assert state['climate']=='cold' and state['disaster']=='hail' and not state['automatic']
        state=client.patch('/api/garden/simulation',json={'automatic':True}).json()['simulation']
        assert state['automatic'] and state['climate']=='hot' and state['disaster']=='drought'
        clock[0]+=29
        assert client.get('/api/garden').json()['simulation']['disaster']=='drought'
        clock[0]+=1
        assert client.get('/api/garden').json()['simulation']['disaster']=='flood'
        client.get('/api/garden')
        assert len(choices)==2
        state=client.patch('/api/garden/simulation',json={'weather':'snow'}).json()['simulation']
        assert not state['automatic'] and state['weather']=='snow'
        clock[0]+=60
        assert client.get('/api/garden').json()['simulation']['weather']=='snow'
        assert client.patch('/api/garden/simulation',json={'climate':'invalid'}).status_code==422
        assert client.patch('/api/garden/simulation',json={'disaster':'invalid'}).status_code==422
    finally:
        client.patch('/api/garden/simulation',json={'climate':'temperate','disaster':'none','weather':'sunny','automatic':False})


def test_seasons_persist_and_pause_random_environment():
    from db import db
    from garden import init_garden
    before=client.get('/api/garden').json()['simulation']
    try:
        for season in ['spring','summer','autumn','winter']:
            client.patch('/api/garden/simulation',json={'automatic':True})
            response=client.patch('/api/garden/simulation',json={'season':season})
            assert response.status_code==200
            state=response.json()['simulation']
            assert state['season']==season and state['automatic'] is False
            assert client.get('/api/garden').json()['simulation']['season']==season
            with db() as c: assert c.execute('SELECT season FROM farm_environment WHERE id=1').fetchone()['season']==season
        init_garden()  # Repeated startup migration preserves the selected season.
        assert client.get('/api/garden').json()['simulation']['season']=='winter'
        assert client.patch('/api/garden/simulation',json={'season':'invalid'}).status_code==422
        state=client.patch('/api/garden/simulation',json={'automatic':True}).json()['simulation']
        assert state['season']=='winter' and state['automatic'] is True
    finally:
        client.patch('/api/garden/simulation',json={k:before[k] for k in ['season','climate','disaster','weather','automatic']})


def test_day_cycle_clock_pause_speed_and_validation(monkeypatch):
    import garden
    clock=[8000.0]
    monkeypatch.setattr(garden.time,'time',lambda:clock[0])
    try:
        state=client.patch('/api/garden/simulation',json={'hour':6,'day_seconds':240,'day_running':True}).json()['simulation']
        assert state['hour']==6 and state['day_running']
        clock[0]+=60
        assert client.get('/api/garden').json()['simulation']['hour']==12
        state=client.patch('/api/garden/simulation',json={'day_running':False}).json()['simulation']
        assert state['hour']==12 and not state['day_running']
        clock[0]+=100
        assert client.get('/api/garden').json()['simulation']['hour']==12
        client.patch('/api/garden/simulation',json={'hour':23,'day_seconds':120,'day_running':True})
        clock[0]+=10
        assert client.get('/api/garden').json()['simulation']['hour']==1
        state=client.patch('/api/garden/simulation',json={'hour':18}).json()['simulation']
        assert state['hour']==18 and not state['day_running']
        for body in [{'hour':24},{'hour':-1},{'day_seconds':0}]:
            assert client.patch('/api/garden/simulation',json=body).status_code==422
    finally:
        client.patch('/api/garden/simulation',json={'hour':12,'day_running':False,'day_seconds':240})


def test_farm_area_multiplier_persists_without_changing_records():
    from garden import init_garden
    original=client.get('/api/garden').json()['simulation']['area_multiplier']
    plots=client.get('/api/plots').json()
    try:
        for multiplier in [1,2,3,4]:
            response=client.patch('/api/garden/simulation',json={'area_multiplier':multiplier})
            assert response.status_code==200
            assert response.json()['simulation']['area_multiplier']==multiplier
            init_garden()
            assert client.get('/api/garden').json()['simulation']['area_multiplier']==multiplier
        assert client.get('/api/plots').json()==plots
        assert client.patch('/api/garden/simulation',json={'area_multiplier':0}).status_code==422
        assert client.patch('/api/garden/simulation',json={'area_multiplier':5}).status_code==422
    finally:
        client.patch('/api/garden/simulation',json={'area_multiplier':original})


def test_search_discards_irrelevant_feed(monkeypatch):
    import capabilities
    import httpx
    async def fake_get(self,*args,**kwargs):
        return httpx.Response(200,request=httpx.Request('GET','https://www.bing.com/search'),text='<rss><channel><item><title>Microsoft official</title><link>https://microsoft.com/</link><description>Cloud services</description></item><item><title>小麦种植技术</title><link>https://example.org/wheat</link><description>农业生产</description></item></channel></rss>')
    monkeypatch.setattr(httpx.AsyncClient,'get',fake_get)
    response=client.get('/api/tools/search',params={'q':'小麦种植'})
    assert response.status_code==200
    assert [r['name'] for r in response.json()['results']]==['小麦种植技术']


def test_city_ranking_prefers_matching_administrative_region(monkeypatch):
    import httpx
    async def fake_get(self,*args,**kwargs):
        return httpx.Response(200,request=httpx.Request('GET','https://geocoding-api.open-meteo.com/v1/search'),json={'results':[
            {'id':2,'name':'北京','admin1':'重庆市','population':1000},
            {'id':3,'name':'北京','admin1':'四川','population':2000},
            {'id':1,'name':'北京','admin1':'北京市','population':20000000}]})
    monkeypatch.setattr(httpx.AsyncClient,'get',fake_get)
    data=client.get('/api/tools/weather',params={'city':'北京'}).json()
    assert data['places'][0]['id']==1
    assert len(data['places'])==3


def test_chinese_city_full_name_resolution(monkeypatch):
    import httpx
    calls=[]
    async def fake_get(self,*args,**kwargs):
        term=kwargs['params']['name'];calls.append(term)
        place={'id':1,'name':'邢台市','admin1':'河北省','latitude':37.06217,'longitude':114.49272,'feature_code':'PPLA2','population':798770} if term=='邢台市' else {'id':2,'name':'邢台','admin1':'河南','latitude':32.17017,'longitude':114.22429,'feature_code':'PPL'}
        return httpx.Response(200,request=httpx.Request('GET','https://geocoding-api.open-meteo.com/v1/search'),json={'results':[place]})
    monkeypatch.setattr(httpx.AsyncClient,'get',fake_get)
    places=client.get('/api/tools/weather',params={'city':'邢台'}).json()['places']
    assert set(calls)=={'邢台','邢台市'}
    assert places[0]['admin1']=='河北省' and places[0]['latitude']==37.06217
    assert places[1]['admin1']=='河南'


def test_answer_evidence_history_and_correction_feedback(monkeypatch):
    from types import SimpleNamespace as NS
    calls=[]
    source={'name':'农业技术资料','source':'https://example.org/agriculture','content':'育苗需记录温湿度'}
    monkeypatch.setattr(agents,'search',lambda query,agent=None:[dict(source)])
    class Fake:
        def __init__(self,**kw):self.chat=NS(completions=self)
        async def close(self):pass
        async def create(self,**kw):
            calls.append(kw)
            if kw.get('stream'):
                async def chunks():yield NS(choices=[NS(delta=NS(content='建议记录温湿度[1]。'))])
                return chunks()
            return NS(choices=[NS(message=NS(content='{"summary":"记录温湿度","questions":[]}'))])
    monkeypatch.setenv('DEEPSEEK_API_KEY','test-placeholder')
    monkeypatch.setattr(agents,'AsyncOpenAI',Fake)
    response=client.post('/api/chat',json={'message':'番茄育苗如何记录'})
    events=[json.loads(s[6:]) for s in response.text.split('\n\n') if s.startswith('data: ')]
    cid=events[0]['id'];mid=events[-1]['message_id']
    stored=client.get('/api/conversations/'+cid).json()
    assert json.loads(stored[-1]['sources'])[0]['citation']==1
    assert all('不知道' in call['messages'][0]['content'] for call in calls)
    client.post('/api/chat',json={'conversation_id':cid,'message':'你刚才错了，我种的是黄瓜'})
    assert any(m['content']=='你刚才错了，我种的是黄瓜' for m in calls[-1]['messages'])
    assert client.post('/api/feedback',json={'message_id':mid,'rating':-1,'comment':'作物理解错误'}).status_code==200
    assert rows('SELECT comment FROM feedback WHERE message_id=? AND rating=-1',(mid,))[0]['comment']=='作物理解错误'
    assert client.post('/api/feedback',json={'message_id':stored[0]['id'],'rating':-1}).status_code==404


def test_li_baoguo_imported_video_and_history(monkeypatch):
    folder=TEST_ROOT/'data'/'media';folder.mkdir(parents=True,exist_ok=True)
    payload=b'\x00\x00\x00\x18ftypmp42'+b'0'*80
    (folder/'li-baoguo.mp4').write_bytes(payload)
    monkeypatch.setattr(agents,'ROOT',TEST_ROOT)
    monkeypatch.delenv('DEEPSEEK_API_KEY',raising=False)
    response=client.post('/api/chat',json={'message':'给我生成一段关于李保国的视频'})
    events=[json.loads(s[6:]) for s in response.text.split('\n\n') if s.startswith('data: ')]
    assert events[-1]['type']=='done' and events[-1]['media'][0]['url']=='/api/media/li-baoguo'
    stored=client.get('/api/conversations/'+events[0]['id']).json()[-1]
    assert json.loads(stored['media'])[0]['type']=='video'
    assert stored['content']=='视频已准备好，请播放。'
    assert not agents.requested_li_video('介绍李保国教授')
    assert not agents.requested_li_video('不要播放李保国的视频')
    assert not agents.requested_li_video('给我生成小麦种植视频')
    response=client.get('/api/media/li-baoguo',headers={'Range':'bytes=0-11'})
    assert response.status_code==206 and response.content==payload[:12]


def test_media_keyword_waits_before_processing(monkeypatch):
    delays=[]
    async def fake_sleep(seconds):delays.append(seconds)
    monkeypatch.setattr(agents.asyncio,'sleep',fake_sleep)
    monkeypatch.delenv('DEEPSEEK_API_KEY',raising=False)
    for text in ['请分析图片','给我生成视频','图片和视频都看看','普通种植问题']:
        delays.clear()
        response=client.post('/api/chat',json={'message':text})
        events=[json.loads(s[6:]) for s in response.text.split('\n\n') if s.startswith('data: ')]
        media=any(k in text for k in ['图片','视频'])
        expected=8 if '视频' in text else 5 if '图片' in text else 0
        assert delays==([expected] if media else [])
        if media:
            assert events[1]['type']=='waiting' and events[1]['seconds']==expected
            assert events[2]['type']=='error'
        else:assert events[1]['type']=='error'


def test_crop_image_matching_and_history(monkeypatch):
    from crop_media import NAMES,requested_crop_images
    assert len(NAMES)==36
    assert [x['title'] for x in requested_crop_images('生成胡萝卜图片')]==['胡萝卜图片']
    assert [x['title'] for x in requested_crop_images('给我番茄和黄瓜图片')]==['西红柿图片','黄瓜图片']
    assert not requested_crop_images('分析黄瓜图片病害')
    folder=TEST_ROOT/'data'/'media'/'crops';folder.mkdir(parents=True,exist_ok=True)
    (folder/'14.jpg').write_bytes(b'test-image')
    monkeypatch.setattr(agents,'ROOT',TEST_ROOT)
    async def wait(seconds):pass
    monkeypatch.setattr(agents.asyncio,'sleep',wait)
    response=client.post('/api/chat',json={'message':'生成黄瓜图片'})
    events=[json.loads(s[6:]) for s in response.text.split('\n\n') if s.startswith('data: ')]
    assert events[-1]['media'][0]['url']=='/api/media/crops/14'
    assert json.loads(client.get('/api/conversations/'+events[0]['id']).json()[-1]['media'])[0]['width']==1920
    assert client.get('/api/media/crops/14').content==b'test-image'
    assert client.get('/api/media/crops/99').status_code==404
