"""Public-source tools. External text is evidence, never instructions."""
from datetime import datetime, timezone
import xml.etree.ElementTree as ET
import re
import asyncio
from urllib.parse import quote
import httpx
from fastapi import APIRouter, HTTPException, Query

router=APIRouter(prefix='/api/tools')

async def web_search(query: str):
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        response=await client.get('https://www.bing.com/search',params={'q':query,'format':'rss'},headers={'User-Agent':'NongzhuAI/1.0'})
        response.raise_for_status()
    if len(response.content)>2_000_000: raise ValueError('Search response too large')
    root=ET.fromstring(response.content)
    results=[{'name':item.findtext('title','')[:300], 'source':item.findtext('link',''), 'content':item.findtext('description','')[:1500], 'published':item.findtext('pubDate','')} for item in root.findall('./channel/item')[:6] if item.findtext('link','').startswith(('https://','http://'))]
    # Reject unrelated feeds rather than presenting a successful HTTP response as a useful search.
    terms=re.findall(r'[a-zA-Z0-9]{2,}|[\u4e00-\u9fff]+',query.lower())
    tokens=[part for term in terms for part in ([term[i:i+2] for i in range(len(term)-1)] if re.search(r'[\u4e00-\u9fff]',term) else [term])]
    return [r for r in results if any(t in (r['name']+' '+r['content']).lower() for t in tokens)]


@router.get('/search')
async def search(q:str=Query(min_length=2,max_length=300)):
    try: return {'results':await web_search(q),'provider':'Bing RSS','retrieved_at':datetime.now(timezone.utc).isoformat(),'notice':'网页摘要未经逐条核验，市场报价和政策有效性需打开原始来源确认。'}
    except Exception as e: raise HTTPException(502,'网页检索暂不可用，请稍后重试。') from e

@router.get('/weather')
async def weather(city:str=Query(min_length=2,max_length=100)):
    try:
        name=city.strip()
        names=[name]
        if re.fullmatch(r'[\u4e00-\u9fff]{2,12}',name) and not name.endswith(('市','县','区','镇','乡','村','省')):
            names.append(name+'市')
        async with httpx.AsyncClient(timeout=15) as client:
            async def lookup(term):
                response=await client.get('https://geocoding-api.open-meteo.com/v1/search',params={'name':term,'count':10,'language':'zh','format':'json'})
                response.raise_for_status()
                return response.json().get('results',[])
            batches=await asyncio.gather(*(lookup(term) for term in names),return_exceptions=True)
        if all(isinstance(batch,Exception) for batch in batches): raise ValueError('Geocoding unavailable')
        unique={}
        for batch in batches:
            if isinstance(batch,Exception): continue
            for place in batch: unique.setdefault(place['id'],place)
        places=list(unique.values())
        normalized=name.removesuffix('市').casefold()
        def rank(p):
            exact=str(p.get('name','')).removesuffix('市').casefold()==normalized
            administrative=str(p.get('feature_code','')).startswith('PPLA') or p.get('feature_code')=='PPLC'
            province=str(p.get('admin1','')).removesuffix('市').casefold()==normalized
            return (exact,province,administrative,int(p.get('population') or 0))
        places.sort(key=rank,reverse=True)
        return {'places':[{k:p.get(k) for k in ['id','name','country','admin1','admin2','latitude','longitude']} for p in places[:10]]}
    except Exception as e: raise HTTPException(502,'地区查询暂不可用，可尝试城市拼音。') from e

@router.get('/weather/forecast')
async def forecast(latitude:float=Query(ge=-90,le=90),longitude:float=Query(ge=-180,le=180)):
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response=await client.get('https://api.open-meteo.com/v1/forecast',params={'latitude':latitude,'longitude':longitude,'current':'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m','daily':'temperature_2m_max,temperature_2m_min,precipitation_sum','forecast_days':3,'timezone':'auto'})
            response.raise_for_status()
        return {**response.json(),'source':'https://open-meteo.com/','retrieved_at':datetime.now(timezone.utc).isoformat(),'notice':'真实外部气象模型数据，非农田传感器实测；不自动替代 3D 模拟天气。'}
    except Exception as e: raise HTTPException(502,'气象服务暂不可用，请稍后重试。') from e

def extract_frames(path):
    import cv2
    capture=cv2.VideoCapture(str(path))
    try:
        if not capture.isOpened(): raise ValueError('无法解码该视频')
        count=capture.get(cv2.CAP_PROP_FRAME_COUNT);fps=capture.get(cv2.CAP_PROP_FPS)
        if count<=0 or fps<=0: raise ValueError('无法读取视频时长')
        duration=count/fps
        if duration>600: raise ValueError('视频不能超过 10 分钟')
        result=[]
        for fraction in [.1,.5,.9]:
            capture.set(cv2.CAP_PROP_POS_FRAMES,int((count-1)*fraction))
            ok,frame=capture.read()
            if not ok: continue
            height,width=frame.shape[:2]
            if max(height,width)>960: frame=cv2.resize(frame,(max(1,int(width*960/max(height,width))),max(1,int(height*960/max(height,width)))))
            ok,encoded=cv2.imencode('.jpg',frame,[cv2.IMWRITE_JPEG_QUALITY,80])
            if ok: result.append({'seconds':round(duration*fraction,2),'bytes':encoded.tobytes()})
        if not result: raise ValueError('未能提取视频画面')
        return result
    finally: capture.release()
