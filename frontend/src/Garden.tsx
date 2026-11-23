import {useCallback,useEffect,useRef,useState} from 'react';
import {Droplets,Sprout,Wheat,ArrowLeft,Check,Loader2,ChevronDown,ChevronUp} from 'lucide-react';
import type {Weather,Pest,Environment,Climate,Disaster,Season} from './FarmSimulation';
import {api,type Plot} from './api';

export type Slot={id:number;crop:string|null;progress:number;water:number;harvests:number};
type Snapshot={simulation:Environment&{weather:Weather;pests:Pest[]};slots:Slot[];crops:{name:string;seconds:number}[];events:{id:number;slot_id:number;action:string;crop:string;created:number}[]};
export function slotPlot(s:Slot):Plot{
 const stage=s.progress>=100?'成熟期':s.progress>=78?'灌浆期':s.progress>=58?'抽穗期':s.progress>=42?'开花期':s.progress>=18?'生长期':'幼苗期';
 return {id:-s.id,name:`体验田 ${String(s.id).padStart(2,'0')}`,crop:s.crop||'待播种',region:'模拟种植体验区',area:1,planted:'',stage:s.crop?stage:'待播种',status:s.progress>=100?'待收获':s.water<20?'需关注':'健康',notes:'互动模拟，不代表真实农业生长时间或水分',simulated:true};
}
export function useGarden(enabled:boolean){
 const [data,setData]=useState<Snapshot>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[effect,setEffect]=useState<{slot:number;kind:string;key:number}>();
 const lock=useRef(false),sequence=useRef(0);
 const refresh=useCallback(async()=>{if(lock.current)return;const n=++sequence.current;try{const d=await api<Snapshot>('/garden');if(n===sequence.current){setData(d);setError('')}}catch(e:any){if(n===sequence.current)setError(e.message)}},[]);
 useEffect(()=>{if(!enabled)return;refresh();const timer=setInterval(refresh,2000);return()=>{clearInterval(timer);sequence.current++}},[enabled,refresh]);
 const act=async(id:number,action:string,crop?:string)=>{if(lock.current)return;lock.current=true;sequence.current++;setBusy(true);setError('');try{const d=await api<Snapshot>('/garden/'+id,{method:'POST',body:JSON.stringify({action,crop})});setData(d);setEffect({slot:-id,kind:action,key:Date.now()});setNotice(action==='plant'?`已播种${crop}，开始模拟生长`:action==='water'?'已浇水，土壤水分已补充':'收获成功！可以再次选择作物播种')}catch(e:any){setError(e.message)}finally{lock.current=false;setBusy(false)}};
 const simulate=async(body:{area_multiplier?:1|2|3|4;hour?:number;day_running?:boolean;day_seconds?:120|240|600;season?:Season;climate?:Climate;disaster?:Disaster;automatic?:boolean;weather?:Weather;plot_id?:number;kind?:Pest['kind']|'clear';severity?:number})=>{if(lock.current)return false;lock.current=true;sequence.current++;setBusy(true);setError('');try{setData(await api<Snapshot>('/garden/simulation',{method:'PATCH',body:JSON.stringify(body)}));return true}catch(e:any){setError(e.message);return false}finally{lock.current=false;setBusy(false)}};
 const [hour,setHour]=useState(12);
 useEffect(()=>{if(!data)return;const start=performance.now(),env=data.simulation;const update=()=>setHour((env.hour+(env.day_running?(performance.now()-start)/1000*24/env.day_seconds:0))%24);update();if(!env.day_running||!enabled)return;const timer=setInterval(update,250);return()=>clearInterval(timer)},[data,enabled]);
 return {data,hour,error,busy,notice,effect,act,refresh,simulate};
}
export function GardenPanel({garden,slotId,onBack,onSelect}:{garden:ReturnType<typeof useGarden>;slotId?:number;onBack:()=>void;onSelect:(id:number)=>void}){
 const [crop,setCrop]=useState('小麦');
 const [collapsed,setCollapsed]=useState(false);
 const slot=garden.data?.slots.find(s=>s.id===slotId),spec=garden.data?.crops.find(c=>c.name===crop);
 return <section className={'garden-panel '+(collapsed?'collapsed':'')} aria-label="模拟种植操作"><header><div><Sprout size={17}/><b>{slot?`体验田 ${String(slot.id).padStart(2,'0')}`:'我的种植体验园'}</b><span>模拟</span></div><div className="garden-header-actions">{slot&&<button title="返回体验园总览" onClick={onBack}><ArrowLeft size={16}/></button>}<button title={collapsed?'展开种植操作':'收起种植操作'} aria-expanded={!collapsed} aria-controls="garden-panel-content" onClick={()=>setCollapsed(c=>!c)}>{collapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</button></div></header>
 <div id="garden-panel-content" hidden={collapsed}>
 {garden.error&&<p className="garden-error" role="alert">{garden.error}<button onClick={garden.refresh}>重试</button></p>}
 {!garden.data?<p className="garden-hint">正在读取本地种植存档…</p>:slot?<>
  {slot.crop?<><div className="garden-crop"><b>{slot.crop}</b><span>{slot.progress>=100?'已成熟，可收获':slot.water<=10?'缺水，生长已暂停':slotPlot(slot).stage}</span></div><label className="garden-meter">生长进度 <b>{slot.progress.toFixed(1)}%</b><progress max={100} value={slot.progress}/></label><label className="garden-meter water">模拟土壤水分 <b>{Math.round(slot.water)}%</b><progress max={100} value={slot.water}/></label><div className="garden-actions"><button disabled={garden.busy||slot.water>=99} onClick={()=>garden.act(slot.id,'water')}><Droplets size={16}/> 浇水 +35%</button><button disabled={garden.busy||slot.progress<100} onClick={()=>garden.act(slot.id,'harvest')}><Wheat size={16}/> 收获</button></div></>:<><p className="garden-hint">这片田还空着，选一种喜欢的植物吧。</p><label className="garden-select">选择作物<select value={crop} onChange={e=>setCrop(e.target.value)}>{garden.data.crops.map(c=><option key={c.name}>{c.name}</option>)}</select></label><p className="garden-hint">水分充足时约 {Math.round((spec?.seconds||180)/60*10)/10} 分钟成熟。</p><button className="primary garden-plant" disabled={garden.busy} onClick={()=>garden.act(slot.id,'plant',crop)}>{garden.busy?<Loader2 className="spin" size={15}/>:<Sprout size={15}/>} 播种{crop}</button></>}
  <p className="garden-hint">本田累计收获 {slot.harvests} 次 · 刷新后保留进度</p>
 </>:<><p className="garden-hint">16 块独立体验田，点击田地开始播种。</p><div className="garden-slots">{garden.data.slots.map(s=><button key={s.id} onClick={()=>onSelect(s.id)} title={`体验田${s.id}：${s.crop||'待播种'}`} className={s.progress>=100?'ripe':s.crop?'planted':''}><span>{String(s.id).padStart(2,'0')}</span>{s.progress>=100?<Check size={13}/>:<Sprout size={13}/>}<small>{s.crop||'空地'}</small></button>)}</div><p className="garden-hint">已种 {garden.data.slots.filter(s=>s.crop).length}/16 块 · 累计收获 {garden.data.slots.reduce((n,s)=>n+s.harvests,0)} 次</p></>}
 {garden.notice&&<p className="garden-notice" role="status">{garden.notice}</p>}
 {garden.data&&garden.data.events.length>0&&<details className="garden-events"><summary>最近种植记录</summary>{garden.data.events.filter(e=>!slot||e.slot_id===slot.id).slice(0,5).map(e=><p key={e.id}>{new Date(e.created*1000).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} · {e.slot_id}号田 · {e.action==='plant'?'播种':e.action==='water'?'浇水':'收获'}{e.crop}</p>)}</details>}
 <footer>模拟时间与水分不用于真实农事决策。体验园独立存档，不改动真实地块档案。</footer>
 </div></section>;
}
