export const CROPS={'小麦':180,'玉米':240,'胡萝卜':150,'番茄':270,'南瓜':300};
export function initial(){const now=Date.now()/1000;return {plots:['水稻','小麦','玉米','蔬菜','大豆','水稻'].map((crop,i)=>({id:i+1,name:['向阳一号田','青禾二号田','丰登三号田','时蔬四号田','绿野五号田','稻香六号田'][i],crop,region:'浙江 · 杭州',area:3,planted:'2026-10-01',stage:'生长期',status:'健康',notes:'云端模拟示例',simulated:1})),tasks:[],conversations:[],messages:[],runs:[],feedback:[],documents:[],uploads:[],events:[],slots:Array.from({length:16},(_,i)=>({id:i+1,crop:null,progress:0,water:70,updated:now,harvests:0})),simulation:{climate:'temperate',disaster:'none',next_change:0,season:'spring',hour:12,day_seconds:240,area_multiplier:1,day_running:false,automatic:false,weather:'sunny',pests:[],updated:now}}}
export function advance(r,now){const elapsed=Math.max(0,now-r.updated);return {...r,updated:now,progress:r.crop?Math.min(100,r.progress+Math.min(elapsed,Math.max(0,(r.water-10)/.12))*100/CROPS[r.crop]):r.progress,water:r.crop?Math.max(0,r.water-elapsed*.12):r.water}}
export function snapshot(s,now=Date.now()/1000){const sim={...s.simulation};if(sim.day_running)sim.hour=(sim.hour+Math.max(0,now-sim.updated)*24/sim.day_seconds)%24;
 if(sim.automatic){const presets=[['temperate','sunny','none'],['humid','rain','flood'],['hot','sunny','drought'],['cold','snow','none'],['temperate','cloudy','wind'],['cold','rain','hail'],['humid','cloudy','none'],['temperate','rain','none']];const tick=Math.floor(Math.max(0,now-sim.next_change)/30);[sim.climate,sim.weather,sim.disaster]=presets[tick%presets.length];sim.next_change=sim.next_change+(tick+1)*30;}
 return {slots:s.slots.map(r=>advance(r,now)),crops:Object.entries(CROPS).map(([name,seconds])=>({name,seconds})),simulated:true,simulation:sim,events:s.events.slice(-12).reverse()}}
export function fail(status,detail){throw Object.assign(new Error(detail),{status})}
export function gardenAction(s,id,b,now=Date.now()/1000){const i=s.slots.findIndex(r=>r.id===id);if(i<0)fail(404,'体验田不存在');const r=advance(s.slots[i],now);let crop=r.crop;
 if(b.action==='plant'){if(r.crop)fail(409,'此田已有作物，请成熟收获后再播种');if(!CROPS[b.crop])fail(422,'请选择作物');Object.assign(r,{crop:b.crop,progress:0,water:70});crop=b.crop;}
 else if(b.action==='water'){if(!r.crop)fail(409,'请先播种');if(r.water>=99)fail(409,'水分充足，暂时无需浇水');r.water=Math.min(100,r.water+35)}
 else if(b.action==='harvest'){if(!r.crop||r.progress<100)fail(409,'作物尚未成熟，暂不能收获');Object.assign(r,{crop:null,progress:0,water:70,harvests:r.harvests+1})}else fail(422,'操作无效');
 s.slots[i]=r;s.events.push({id:now,slot_id:id,action:b.action,crop,created:now});s.events=s.events.slice(-100);return snapshot(s,now)}
export function simulation(s,b,now=Date.now()/1000){const r=s.simulation;const fields={area_multiplier:[1,2,3,4],day_seconds:[120,240,600],season:['spring','summer','autumn','winter'],climate:['temperate','hot','humid','cold'],disaster:['none','drought','flood','hail','wind'],weather:['sunny','cloudy','rain','snow']};
 for(const [k,values] of Object.entries(fields))if(b[k]!==undefined&&!values.includes(b[k]))fail(422,'模拟选项无效');
 if(b.hour!==undefined&&(!Number.isFinite(b.hour)||b.hour<0||b.hour>=24))fail(422,'时间无效');
 for(const k of ['automatic','day_running'])if(b[k]!==undefined&&typeof b[k]!=='boolean')fail(422,'开关无效');
 Object.assign(r,snapshot(s,now).simulation,{updated:now});if(['season','climate','disaster','weather'].some(k=>b[k]!==undefined))r.automatic=false;
 for(const k of [...Object.keys(fields),'hour','day_running','automatic'])if(b[k]!==undefined)r[k]=b[k];
 if(b.hour!==undefined)r.day_running=false;if(b.automatic!==undefined)r.next_change=now;
 if(b.kind!==undefined){if(!['insects','disease','clear'].includes(b.kind)||!Number.isInteger(b.plot_id)||!b.plot_id||!(b.plot_id<0?s.slots:s.plots).some(p=>p.id===Math.abs(b.plot_id)))fail(422,'请选择有效地块');const severity=b.severity??45;if(!Number.isInteger(severity)||severity<10||severity>100)fail(422,'强度应在10到100之间');r.pests=r.pests.filter(p=>p.plotId!==b.plot_id);if(b.kind!=='clear')r.pests.push({plotId:b.plot_id,kind:b.kind,severity})}return snapshot(s,now)}
export function nextId(list){return Math.max(0,...list.map(v=>Number(v.id)||0))+1}
