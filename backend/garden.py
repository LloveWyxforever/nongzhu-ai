"""Persistent, explicitly simulated garden. Never updates agricultural records."""
import time
import random
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
from db import db

router=APIRouter(prefix='/api/garden')
CROPS={'小麦':180,'玉米':240,'胡萝卜':150,'番茄':270,'南瓜':300}

def init_garden():
    with db() as c:
        c.executescript('''CREATE TABLE IF NOT EXISTS garden_slots(
        id INTEGER PRIMARY KEY, crop TEXT, progress REAL NOT NULL DEFAULT 0,
        water REAL NOT NULL DEFAULT 70, updated REAL NOT NULL, harvests INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS garden_events(id INTEGER PRIMARY KEY,slot_id INTEGER,action TEXT,crop TEXT,created REAL);''')
        c.executescript('''CREATE TABLE IF NOT EXISTS farm_weather(id INTEGER PRIMARY KEY CHECK(id=1),weather TEXT NOT NULL);
        INSERT OR IGNORE INTO farm_weather VALUES(1,'sunny');
        CREATE TABLE IF NOT EXISTS farm_pests(plot_id INTEGER PRIMARY KEY,kind TEXT NOT NULL,severity INTEGER NOT NULL);''')
        c.executescript('''CREATE TABLE IF NOT EXISTS farm_environment(id INTEGER PRIMARY KEY CHECK(id=1),climate TEXT NOT NULL DEFAULT 'temperate',disaster TEXT NOT NULL DEFAULT 'none',automatic INTEGER NOT NULL DEFAULT 0,next_change REAL NOT NULL DEFAULT 0);
        INSERT OR IGNORE INTO farm_environment(id) VALUES(1);''')
        if 'season' not in {row['name'] for row in c.execute('PRAGMA table_info(farm_environment)')}:
            c.execute("ALTER TABLE farm_environment ADD COLUMN season TEXT NOT NULL DEFAULT 'spring'")
        for name,definition in [('area_multiplier','INTEGER NOT NULL DEFAULT 1'),('hour','REAL NOT NULL DEFAULT 12'),('day_running','INTEGER NOT NULL DEFAULT 0'),('day_updated','REAL NOT NULL DEFAULT 0'),('day_seconds','INTEGER NOT NULL DEFAULT 240')]:
            if name not in {row['name'] for row in c.execute('PRAGMA table_info(farm_environment)')}:
                c.execute(f'ALTER TABLE farm_environment ADD COLUMN {name} {definition}')
        c.executemany('INSERT OR IGNORE INTO garden_slots(id,updated) VALUES(?,?)',[(i,time.time()) for i in range(1,17)])

def advance(row,now):
    """Water falls 0.12/s; growth stops when water reaches 10, even offline."""
    r=dict(row)
    elapsed=max(0,now-r['updated'])
    if r['crop']:
        active=min(elapsed,max(0,(r['water']-10)/.12))
        r['progress']=min(100,r['progress']+active*100/CROPS[r['crop']])
        r['water']=max(0,r['water']-elapsed*.12)
    r['updated']=now
    return r

def save(c,r):
    c.execute('UPDATE garden_slots SET crop=?,progress=?,water=?,updated=?,harvests=? WHERE id=?',(r['crop'],r['progress'],r['water'],r['updated'],r['harvests'],r['id']))

def advance_day(c,now):
    r=dict(c.execute('SELECT * FROM farm_environment WHERE id=1').fetchone())
    hour=(r['hour']+max(0,now-r['day_updated'])*24/r['day_seconds'])%24 if r['day_running'] and r['day_updated'] else r['hour']
    c.execute('UPDATE farm_environment SET hour=?,day_updated=? WHERE id=1',(hour,now))
    return hour

def environment(c,now):
    # Shared lazy clock: one persisted transition, even with multiple polling clients.
    c.execute('UPDATE farm_environment SET next_change=next_change WHERE id=1')
    advance_day(c,now)
    r=dict(c.execute('SELECT * FROM farm_environment WHERE id=1').fetchone())
    if r['automatic'] and now>=r['next_change']:
        climate,weather,disaster=random.choice([
            ('temperate','sunny','none'),('humid','rain','flood'),
            ('hot','sunny','drought'),('cold','snow','none'),
            ('temperate','cloudy','wind'),('cold','rain','hail'),
            ('humid','cloudy','none'),('temperate','rain','none')])
        c.execute('UPDATE farm_environment SET climate=?,disaster=?,next_change=? WHERE id=1',(climate,disaster,now+30))
        c.execute('UPDATE farm_weather SET weather=? WHERE id=1',(weather,))
        r.update(climate=climate,disaster=disaster,next_change=now+30)
    return {**{k:r[k] for k in ('climate','disaster','next_change','season','hour','day_seconds','area_multiplier')},'day_running':bool(r['day_running']),'automatic':bool(r['automatic'])}

def snapshot(c,now):
    env=environment(c,now)
    result=[]
    for row in c.execute('SELECT * FROM garden_slots ORDER BY id').fetchall():
        r=advance(row,now);save(c,r);result.append(r)
    return {'slots':result,'crops':[{'name':name,'seconds':seconds} for name,seconds in CROPS.items()], 'simulated':True,
            'simulation':{**env,'weather':c.execute('SELECT weather FROM farm_weather WHERE id=1').fetchone()['weather'],
                          'pests':[{'plotId':r['plot_id'],'kind':r['kind'],'severity':r['severity']} for r in c.execute('SELECT * FROM farm_pests ORDER BY plot_id')]},
            'events':[dict(r) for r in c.execute('SELECT * FROM garden_events ORDER BY id DESC LIMIT 12')]}

@router.get('')
def garden():
    with db() as c: return snapshot(c,time.time())

class Action(BaseModel):
    action:Literal['plant','water','harvest']
    crop:Literal['小麦','玉米','胡萝卜','番茄','南瓜'] | None=None

class Simulation(BaseModel):
    area_multiplier:Literal[1,2,3,4] | None=None
    hour:float | None=Field(default=None,ge=0,lt=24,allow_inf_nan=False)
    day_running:bool | None=None
    day_seconds:Literal[120,240,600] | None=None
    season:Literal['spring','summer','autumn','winter'] | None=None
    climate:Literal['temperate','hot','humid','cold'] | None=None
    disaster:Literal['none','drought','flood','hail','wind'] | None=None
    automatic:bool | None=None
    weather:Literal['sunny','cloudy','rain','snow'] | None=None
    plot_id:int | None=None
    kind:Literal['insects','disease','clear'] | None=None
    severity:int=45

@router.patch('/simulation')
def simulation(body:Simulation):
    if not 10<=body.severity<=100: raise HTTPException(422,'强度应在 10 到 100 之间')
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        now=time.time()
        advance_day(c,now)
        if body.area_multiplier is not None: c.execute('UPDATE farm_environment SET area_multiplier=? WHERE id=1',(body.area_multiplier,))
        if body.hour is not None: c.execute('UPDATE farm_environment SET hour=?,day_running=0 WHERE id=1',(body.hour,))
        if body.day_seconds is not None: c.execute('UPDATE farm_environment SET day_seconds=? WHERE id=1',(body.day_seconds,))
        if body.day_running is not None: c.execute('UPDATE farm_environment SET day_running=? WHERE id=1',(int(body.day_running),))
        if body.season is not None or body.climate is not None or body.disaster is not None or body.weather is not None:
            c.execute('UPDATE farm_environment SET automatic=0 WHERE id=1')
        if body.season is not None: c.execute('UPDATE farm_environment SET season=? WHERE id=1',(body.season,))
        if body.climate is not None: c.execute('UPDATE farm_environment SET climate=? WHERE id=1',(body.climate,))
        if body.disaster is not None: c.execute('UPDATE farm_environment SET disaster=? WHERE id=1',(body.disaster,))
        if body.automatic is not None: c.execute('UPDATE farm_environment SET automatic=?,next_change=0 WHERE id=1',(int(body.automatic),))
        if body.kind is not None:
            pid=body.plot_id
            if pid is None or pid==0: raise HTTPException(422,'请选择目标地块')
            table='garden_slots' if pid<0 else 'plots'
            if not c.execute(f'SELECT id FROM {table} WHERE id=?',(abs(pid),)).fetchone(): raise HTTPException(404,'地块不存在')
            if body.kind=='clear': c.execute('DELETE FROM farm_pests WHERE plot_id=?',(pid,))
            else: c.execute('INSERT INTO farm_pests VALUES(?,?,?) ON CONFLICT(plot_id) DO UPDATE SET kind=excluded.kind,severity=excluded.severity',(pid,body.kind,body.severity))
        if body.weather is not None: c.execute('UPDATE farm_weather SET weather=? WHERE id=1',(body.weather,))
        return snapshot(c,time.time())

@router.post('/{slot_id}')
def act(slot_id:int,body:Action):
    with db() as c:
        # Serialize read-modify-write so double clicks cannot duplicate harvests.
        c.execute('BEGIN IMMEDIATE')
        row=c.execute('SELECT * FROM garden_slots WHERE id=?',(slot_id,)).fetchone()
        if row is None: raise HTTPException(404,'体验田不存在')
        now=time.time();r=advance(row,now)
        crop=r['crop']
        if body.action=='plant':
            if r['crop']: raise HTTPException(409,'此田已有作物，请成熟收获后再播种')
            if not body.crop: raise HTTPException(422,'请选择作物')
            r.update(crop=body.crop,progress=0,water=70);crop=body.crop
        elif body.action=='water':
            if not r['crop']: raise HTTPException(409,'请先播种')
            if r['water']>=99: raise HTTPException(409,'水分充足，暂时无需浇水')
            r['water']=min(100,r['water']+35)
        else:
            if not r['crop'] or r['progress']<100: raise HTTPException(409,'作物尚未成熟，暂不能收获')
            r.update(crop=None,progress=0,water=70,harvests=r['harvests']+1)
        save(c,r)
        c.execute('INSERT INTO garden_events(slot_id,action,crop,created) VALUES(?,?,?,?)',(slot_id,body.action,crop,now))
        return snapshot(c,now)
