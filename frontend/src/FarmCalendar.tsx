import {useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,Plus,X} from 'lucide-react';
import type {Task} from './api';

export function dateKey(date:Date){
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

export default function FarmCalendar({tasks,onCreate,onToggle,onClose,canCreate}:{tasks:Task[];onCreate:(date:string)=>void;onToggle:(task:Task)=>Promise<void>;onClose:()=>void;canCreate:boolean}){
 const today=dateKey(new Date());
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const [chosen,setChosen]=useState(today);
 const first=new Date(month.getFullYear(),month.getMonth(),1);
 const offset=(first.getDay()+6)%7;
 const days=Array.from({length:42},(_,i)=>new Date(month.getFullYear(),month.getMonth(),i-offset+1));
 const daily=tasks.filter(t=>t.due.slice(0,10)===chosen);
 const [pending,setPending]=useState<number>();
 const [error,setError]=useState('');
 function move(step:number){const next=new Date(month.getFullYear(),month.getMonth()+step,1);setMonth(next);setChosen(dateKey(next))}
 return <aside id="home-calendar" className="farm-calendar" aria-label="农事日历">
  <header><h2><CalendarDays size={18}/> 农事日历</h2><button onClick={onClose} title="收起日历" aria-label="收起日历"><X size={17}/></button></header>
  <div className="calendar-month"><button onClick={()=>move(-1)} aria-label="上个月"><ChevronLeft size={18}/></button><b aria-live="polite">{month.getFullYear()} 年 {month.getMonth()+1} 月</b><button onClick={()=>move(1)} aria-label="下个月"><ChevronRight size={18}/></button></div>
  <div className="calendar-week">{['一','二','三','四','五','六','日'].map(d=><span key={d}>{d}</span>)}</div>
  <div className="calendar-grid">{days.map(d=>{const key=dateKey(d),count=tasks.filter(t=>t.due.slice(0,10)===key).length;return <button key={key} className={(d.getMonth()!==month.getMonth()?'outside ':'')+(key===chosen?'chosen ':'')+(key===today?'today':'')} aria-pressed={key===chosen} aria-label={`${key}${key===today?' 今天':''}，${count} 项农事`} onClick={()=>{setChosen(key);if(d.getMonth()!==month.getMonth())setMonth(new Date(d.getFullYear(),d.getMonth(),1))}}><span>{d.getDate()}</span><i className={count?'has-tasks':''}/></button>})}</div>
  <div className="calendar-tools"><span>圆点表示当天有农事</span><button onClick={()=>{setMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1));setChosen(today)}}>回到今天</button></div>
  <section className="calendar-agenda"><div className="calendar-day-heading"><h3>{chosen.slice(5).replace('-','月')}日</h3><span>{daily.length} 项安排</span></div>
   {error&&<p role="alert">{error}</p>}
   {daily.length?daily.map(t=><label key={t.id} className={'calendar-task '+(t.done?'done':'')}><input type="checkbox" checked={!!t.done} disabled={pending!==undefined} onChange={async()=>{setPending(t.id);setError('');try{await onToggle(t)}catch(e:any){setError(e.message||'更新失败，请重试')}finally{setPending(undefined)}}}/><span><b>{t.title}</b><small>{t.plot_name} · {t.done?'已完成':'待进行'}</small></span></label>):<p className="calendar-empty">当天暂无农事安排</p>}
   <button className="outline calendar-create" disabled={!canCreate} onClick={()=>onCreate(chosen)}><Plus size={15}/> 新增当天农事</button>
   {!canCreate&&<p className="calendar-empty">请先在 3D 数字农场新建地块。</p>}
  </section>
 </aside>
}
