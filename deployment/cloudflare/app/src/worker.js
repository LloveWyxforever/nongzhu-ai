import {initial,snapshot,gardenAction,simulation,nextId,fail} from './state.js';
import knowledge from './knowledge.json';
import {weather,forecast,webSearch} from './tools.js';
import {chat} from './chat.js';
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export function search(s,q,agent){const categories={planting:['粮食作物','经济作物','蔬菜种植','果树种植','土壤与肥料','作物生长管理','农业技术推广'],risk:['病虫害基础','农业气象','农业技术推广'],industry:['农业政策','农产品市场','农业技术推广']};const terms=Array.from({length:Math.min(32,Math.max(0,q.length-2))},(_,i)=>q.slice(i,i+3));return [...knowledge,...s.documents].filter(d=>!s.hiddenDocs?.includes(d.id)&&(!categories[agent]||categories[agent].includes(d.category))).flatMap(d=>{const i=terms.reduce((v,t)=>v>=0?v:d.content.indexOf(t),-1);return i<0?[]:[{name:d.name,source:d.source,content:d.content.slice(Math.max(0,i-150),i+750)}]}).slice(0,5)}
function validatePlot(b){for(const [k,n] of [['name',80],['crop',80],['region',100]])if(typeof b[k]!=='string'||!b[k].trim()||b[k].length>n)fail(422,'地块字段无效');if(!Number.isFinite(b.area)||b.area<=0||b.area>1e6||!validDate(b.planted)||!['待播种','幼苗期','生长期','开花期','抽穗期','灌浆期','成熟期'].includes(b.stage)||!['健康','需关注','待收获'].includes(b.status||'健康')||(b.notes||'').length>4000)fail(422,'地块档案无效');return Object.fromEntries(['name','crop','region','area','planted','stage','status','notes','simulated'].map(k=>[k,k==='simulated'?Number(!!b[k]):b[k]??(k==='status'?'健康':'')]))}
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&new Date(v).toISOString().slice(0,10)===v;
export default {async fetch(req,env,ctx){const url=new URL(req.url),path=url.pathname;
 if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);
 if(path.startsWith('/api/media/')){const file=path==='/api/media/li-baoguo'?'/media/li-baoguo.mp4':/^\/api\/media\/crops\/\d{2}$/.test(path)?'/media/crops/'+path.slice(-2)+'.jpg':null;if(!file)return json({detail:'资源不存在'},404);url.pathname=file;return env.ASSETS.fetch(new Request(url,req))}
 let fresh=false,id=req.headers.get('Cookie')?.match(/(?:^|; )nz_session=([a-f0-9-]{36})(?:;|$)/)?.[1];if(!id){id=crypto.randomUUID();fresh=true}
 const decorate=r=>{const headers=new Headers(r.headers);if(fresh)headers.append('Set-Cookie',`nz_session=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${url.protocol==='https:'?'; Secure':''}`);headers.set('X-Content-Type-Options','nosniff');return new Response(r.body,{status:r.status,headers})};
 try{
 if(!['GET','HEAD'].includes(req.method)){const origin=req.headers.get('Origin');if(origin&&origin!==url.origin)fail(403,'不允许跨站操作');if(req.headers.get('Sec-Fetch-Site')==='cross-site')fail(403,'不允许跨站操作');if(Number(req.headers.get('Content-Length')||0)>20*1024*1024)fail(413,'文件过大')}
 if(path==='/api/health')return decorate(json({status:'ok',database:'Cloudflare D1',ai_configured:!!env.DEEPSEEK_API_KEY,model:env.DEEPSEEK_MODEL,vision_configured:false,weather:'Open-Meteo 外部气象模型',market:'Bing网页来源检索，需核验',video_frames:true,platform:'Cloudflare Workers + D1',ai_access:env.AI_ACCESS_CODE?'访问码保护':'未启用'}));
 if(path==='/api/tools/weather')return decorate(json(await weather(url.searchParams.get('city'))));
 if(path==='/api/tools/weather/forecast')return decorate(json(await forecast(url.searchParams)));
 if(path==='/api/tools/search')return decorate(json(await webSearch(url.searchParams.get('q'))));
 const row=await env.DB.prepare('SELECT value,revision FROM visitor_state WHERE id=?').bind(id).first();let s=row?JSON.parse(row.value):initial(),revision=row?.revision??0;
 if(!row){await env.DB.prepare('INSERT OR IGNORE INTO visitor_state(id,value,updated) VALUES(?,?,?)').bind(id,JSON.stringify(s),Date.now()).run()}
 async function save(){const value=JSON.stringify(s);if(value.length>1800000)fail(413,'当前空间容量已满，请删除不再需要的资料或对话');const result=await env.DB.prepare('UPDATE visitor_state SET value=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(value,Date.now(),id,revision).run();if(!result.meta.changes)fail(409,'数据刚刚发生变化，请刷新重试');revision++}
 const method=req.method,body=async()=>{try{return await req.json()}catch{fail(422,'请求格式错误')}},match=path.match(/\/(\d+)$/),num=match?Number(match[1]):null;
 let result;
 if(path==='/api/garden'&&method==='GET')result=snapshot(s);
 else if(path==='/api/garden/simulation'&&method==='PATCH'){result=simulation(s,await body());await save()}
 else if(/^\/api\/garden\/\d+$/.test(path)&&method==='POST'){result=gardenAction(s,num,await body());await save()}
 else if(path==='/api/plots'&&method==='GET')result=s.plots;
 else if(path==='/api/plots'&&method==='POST'){const p={...validatePlot(await body()),id:nextId(s.plots)};if(s.plots.length>=100)fail(422,'最多100个地块');s.plots.push(p);await save();result={id:p.id}}
 else if(/^\/api\/plots\/\d+$/.test(path)&&method==='PUT'){const i=s.plots.findIndex(p=>p.id===num);if(i<0)fail(404,'地块不存在');s.plots[i]={...validatePlot(await body()),id:num};await save();result={ok:true}}
 else if(path==='/api/tasks'&&method==='GET')result=s.tasks.filter(t=>!url.searchParams.has('plot_id')||t.plot_id===Number(url.searchParams.get('plot_id'))).map(t=>({...t,plot_name:s.plots.find(p=>p.id===t.plot_id)?.name})).sort((a,b)=>a.done-b.done||a.due.localeCompare(b.due));
 else if(path==='/api/tasks'&&method==='POST'){const b=await body();if(!s.plots.some(p=>p.id===b.plot_id)||typeof b.title!=='string'||!b.title.trim()||b.title.length>6000||!validDate(b.due))fail(422,'任务信息无效');const t={id:nextId(s.tasks),plot_id:b.plot_id,title:b.title,due:b.due,kind:String(b.kind||'农事任务').slice(0,100),done:0};s.tasks.push(t);await save();result={id:t.id}}
 else if(/^\/api\/tasks\/\d+$/.test(path)&&method==='PATCH'){const t=s.tasks.find(t=>t.id===num);if(!t)fail(404,'任务不存在');const b=await body();if(typeof b.done!=='boolean')fail(422,'状态无效');t.done=Number(b.done);await save();result={ok:true}}
 else if(path==='/api/conversations'&&method==='GET')result=s.conversations.filter(c=>!url.searchParams.has('agent')||c.agent===url.searchParams.get('agent')).slice().reverse();
 else if(/^\/api\/conversations\/[\w-]+$/.test(path)){const cid=path.split('/').pop();if(!s.conversations.some(c=>c.id===cid))fail(404,'对话不存在');if(method==='GET')result=s.messages.filter(m=>m.conversation_id===cid);else if(method==='DELETE'){s.conversations=s.conversations.filter(c=>c.id!==cid);s.messages=s.messages.filter(m=>m.conversation_id!==cid);s.runs=s.runs.filter(r=>r.conversation_id!==cid);await save();result={ok:true}}}
 else if(path==='/api/runs'&&method==='GET')result=s.runs.filter(r=>!url.searchParams.has('plot_id')||r.plot_id===Number(url.searchParams.get('plot_id'))).slice(-100).reverse();
 else if(path==='/api/feedback'&&method==='POST'){const b=await body();if(!s.messages.some(m=>m.id===b.message_id&&m.role==='assistant')||![1,-1].includes(b.rating)||String(b.comment||'').length>2000)fail(422,'反馈无效');s.feedback.push({...b,comment:b.comment||''});s.feedback=s.feedback.slice(-200);await save();result={ok:true}}
 else if(path==='/api/knowledge/search'&&method==='GET')result=search(s,url.searchParams.get('q')||'');
 else if(path==='/api/knowledge'&&method==='GET')result=[...knowledge,...s.documents].filter(d=>!s.hiddenDocs?.includes(d.id)).map(({content,...d})=>d);
 else if(path==='/api/knowledge'&&method==='POST'){const form=await req.formData(),file=form.get('file');if(!file||typeof file==='string'||file.size>1500000)fail(413,'云端文本上限1.5MB；PDF与DOCX请先在浏览器解析');if(!/\.(txt|md|json)$/i.test(file.name))fail(422,'请上传TXT、Markdown、JSON，或使用浏览器PDF/DOCX解析');const content=await file.text();if(!content.trim())fail(422,'文档没有文字');if(/\.json$/i.test(file.name)){try{JSON.parse(content)}catch{fail(422,'JSON格式无效')}}const d={id:crypto.randomUUID(),name:file.name,category:String(form.get('category')||'农业技术推广').slice(0,100),source:String(form.get('source')||'用户导入，来源待核验').slice(0,2000),content,created:new Date().toISOString()};s.documents.push(d);await save();result={id:d.id,characters:content.length}}
 else if(/^\/api\/knowledge\/[\w-]+$/.test(path)&&method==='DELETE'){const did=path.split('/').pop();s.documents=s.documents.filter(d=>d.id!==did);s.hiddenDocs=[...s.hiddenDocs||[],did];await save();result={ok:true}}
 else if(path==='/api/chat'&&method==='POST')return decorate(await chat(await body(),s,save,env,ctx,req,search));
 else if(path==='/api/uploads')fail(422,'云端附件在浏览器本地预览和抽帧，未配置视觉模型时不会上传');
 else fail(404,'接口不存在');
 return decorate(json(result));
 }catch(e){return decorate(json({detail:e.status?e.message:'云端服务暂时不可用，请稍后重试'},e.status||500))}
 }};
