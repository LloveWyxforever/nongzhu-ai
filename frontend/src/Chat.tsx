import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, Mic, Square, Volume2, ImagePlus, X, Copy, RotateCcw, ThumbsUp, ThumbsDown, Plus, Trash2, Sprout, Check, Loader2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import {api,apiUrl,names,type Plot} from './api';
import DotHands from './DotHands';

type Message={role:string;content:string;id?:number;error?:boolean;sources?:any[]|string;media?:any[]|string};
const specialistCopy:Record<string,{welcome:string;intro:string;suggestions:string[]}>= {
 planting:{welcome:'种植的每一步，都有专业建议。',intro:'专注播种育苗、生长管理、土壤水肥与农事计划。',suggestions:['请帮我制定本周种植管理计划','番茄育苗需要记录哪些信息？','怎样记录作物生长阶段？']},
 risk:{welcome:'从症状线索开始，科学排查风险。',intro:'专注病虫害、作物异常与农业气象风险，辅助分析不等于确诊。',suggestions:['叶片发黄，需要观察什么？','怎样记录虫害发生范围？','连续阴雨对作物有哪些风险？']},
 industry:{welcome:'为好农产品，寻找更好的机会。',intro:'专注销售、品牌、农业政策与合作社，价格和政策必须核验来源。',suggestions:['帮我写一段农产品宣传文案','惠农补贴应该如何核验？','如何为合作社制定销售思路？']}
};
export function useSpeech(onText:(s:string)=>void){const [listening,setListening]=useState(false);const active=useRef<any>(null);useEffect(()=>()=>{active.current?.abort();window.speechSynthesis?.cancel()},[]);return {listening,start:()=>{const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SR){alert('当前浏览器不支持语音识别，请使用文字输入。');return}if(listening){active.current?.stop();return}const r=new SR();active.current=r;r.lang='zh-CN';r.onresult=(e:any)=>onText(e.results[0][0].transcript);r.onerror=()=>{setListening(false);alert('语音识别未完成，请检查麦克风权限或使用文字输入。')};r.onend=()=>setListening(false);r.start();setListening(true)}}}

export default function Chat({plot,agent,compact=false,initial='',onState,contextControl}:{plot?:Plot;agent?:string;compact?:boolean;initial?:string;onState?:(s:string)=>void;contextControl?:ReactNode}){
 const historyId=useId();
 const [historyOpen,setHistoryOpen]=useState(()=>{try{const saved=sessionStorage.getItem('nongzhu-chat-history-open');return saved===null?window.innerWidth>=768:saved==='true'}catch{return window.innerWidth>=768}});
 useEffect(()=>{if(!compact)try{sessionStorage.setItem('nongzhu-chat-history-open',String(historyOpen))}catch{}},[historyOpen,compact]);
 const [messages,setMessages]=useState<Message[]>([]),[input,setInput]=useState(initial),[busy,setBusy]=useState(false),[cid,setCid]=useState<string>(),[hist,setHist]=useState<any[]>([]),[progress,setProgress]=useState<Record<string,string>>({}),[sources,setSources]=useState<any[]>([]),[attachment,setAttachment]=useState<any>(),[consent,setConsent]=useState(false),[notice,setNotice]=useState('');
 const [videoPopup,setVideoPopup]=useState<{url:string;title:string;type?:string}>();
 const [speakingIndex,setSpeakingIndex]=useState<number>();
 const speaking=speakingIndex!==undefined,utteranceRef=useRef<SpeechSynthesisUtterance|null>(null);
 function stopSpeaking(){const previous=utteranceRef.current;utteranceRef.current=null;if(previous){previous.onend=null;previous.onerror=null}window.speechSynthesis?.cancel();setSpeakingIndex(undefined);onState?.('idle')}
 function toggleSpeaking(index:number,text:string){
  if(speakingIndex===index){stopSpeaking();return}
  if(!window.speechSynthesis){setNotice('当前浏览器不支持播报');return}
  stopSpeaking();
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang='zh-CN';utteranceRef.current=utterance;
  const finish=()=>{if(utteranceRef.current!==utterance)return;utteranceRef.current=null;setSpeakingIndex(undefined);onState?.('idle')};
  utterance.onend=finish;utterance.onerror=e=>{if(utteranceRef.current!==utterance)return;finish();if(e.error!=='canceled'&&e.error!=='interrupted')setNotice('播报未完成，请检查设备声音或浏览器语音支持。')};
  setSpeakingIndex(index);onState?.('answering');try{window.speechSynthesis.speak(utterance)}catch{finish();setNotice('无法开始播报，请检查浏览器语音支持。')}
 }
 useEffect(()=>{stopSpeaking()},[cid]);
 useEffect(()=>{if(!videoPopup)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setVideoPopup(undefined)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[videoPopup]);
 const [feedbackTarget,setFeedbackTarget]=useState<number>(),[feedbackText,setFeedbackText]=useState('');
 const [questions,setQuestions]=useState<string[]>([]),[choices,setChoices]=useState<string[]>([]);
 const abort=useRef<AbortController|null>(null),bottom=useRef<HTMLDivElement>(null);const speech=useSpeech(s=>setInput(p=>p+s));
 useEffect(()=>{setInput(initial)},[initial]);
 useEffect(()=>{api('/conversations'+(agent?'?agent='+agent:'?agent=general')).then(setHist).catch(()=>{})},[busy,agent]);
 useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest',behavior:'smooth'})},[messages]);
 useEffect(()=>()=>{abort.current?.abort();if(utteranceRef.current){utteranceRef.current.onend=null;utteranceRef.current.onerror=null;utteranceRef.current=null}onState?.('idle');window.speechSynthesis?.cancel()},[]);
 useEffect(()=>()=>{if(attachment?.url)URL.revokeObjectURL(attachment.url)},[attachment]);
 async function send(text=input){
  if(!text.trim()||busy)return;
  stopSpeaking();setInput('');setMessages(m=>[...m,{role:'user',content:text},{role:'assistant',content:''}]);setBusy(true);setSources([]);setQuestions([]);setChoices([]);setProgress({});setNotice('');onState?.('thinking');abort.current=new AbortController();
  let output='',hadError=false;
  try{
   const res=await fetch(apiUrl('/api/chat'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,conversation_id:cid,plot_id:plot?.id,agent,attachment_id:attachment?.id,consent}),signal:abort.current.signal});
   if(!res.ok)throw Error('对话请求失败，请检查地块或新建对话');
   const reader=res.body!.getReader(),decoder=new TextDecoder();let buffer='';
   while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let split;while((split=buffer.indexOf('\n\n'))>=0){const line=buffer.slice(0,split);buffer=buffer.slice(split+2);if(!line.startsWith('data: '))continue;const event=JSON.parse(line.slice(6));
    if(event.type==='conversation')setCid(event.id);
    if(event.type==='waiting')setMessages(m=>[...m.slice(0,-1),{role:'assistant',content:event.message}]);
    if(event.type==='routing'||event.type==='synthesis')setMessages(m=>[...m.slice(0,-1),{role:'assistant',content:event.message||'正在分析任务…'}]);
    if(event.type==='agent')setProgress(p=>({...p,[event.agent]:event.status}));
    if(event.type==='delta'){output+=event.text;onState?.('answering');setMessages(m=>[...m.slice(0,-1),{role:'assistant',content:output}])}
    if(event.type==='done'){if(event.media?.[0])setVideoPopup(event.media[0]);setSources(event.sources||[]);setQuestions(event.questions||[]);setMessages(m=>[...m.slice(0,-1),{role:'assistant',content:output,id:event.message_id,sources:event.sources||[],media:event.media||[]}])}
    if(event.type==='error'){hadError=true;setMessages(m=>[...m.slice(0,-1),{role:'assistant',content:event.message,error:true}])}
   }if(done)break}
   if(!output&&!hadError)throw Error('服务未返回完整回答，请重试');
  }catch(e:any){setMessages(m=>[...m.slice(0,-1),{role:'assistant',content:e.name==='AbortError'?(output||'已停止生成。'):(e.message||'连接失败，请检查后端服务'),error:e.name!=='AbortError'}])}
  finally{setBusy(false);onState?.('idle')}
 }
 async function upload(file:File){const form=new FormData();form.append('file',file);try{const a=await api('/uploads',{method:'POST',body:form});setAttachment({...a,url:URL.createObjectURL(file),frames:[]});setNotice(a.notice);setConsent(false)}catch(e:any){setNotice(e.message)}}
 return <div className={'chat '+(compact?'compact':'')+(!compact&&historyOpen?' history-open':'')}>
 {videoPopup&&<div className="video-popup-backdrop" onClick={()=>setVideoPopup(undefined)}><section className="video-popup" role="dialog" aria-modal="true" aria-label={videoPopup.title} onClick={e=>e.stopPropagation()}><header><b>{videoPopup.title}</b><button autoFocus aria-label="关闭视频" onClick={()=>setVideoPopup(undefined)}><X size={22}/></button></header>{videoPopup.type==='image'?<img className="popup-crop-image" src={videoPopup.url} alt={videoPopup.title}/>:<><video src={videoPopup.url} controls autoPlay playsInline/><p>若未自动播放，请点击播放键</p></>}</section></div>}
 {!compact&&<aside id={historyId} aria-label="最近对话" hidden={!historyOpen} className="chat-history"><div className="history-heading"><b>对话记录</b><button className="history-close" title="收起对话记录" aria-label="收起对话记录" onClick={()=>setHistoryOpen(false)}><PanelLeftClose size={17}/></button></div><button className="primary" onClick={()=>{if(busy)return;setCid(undefined);setMessages([]);setSources([]);setProgress({})}}><Plus size={16}/> 新建对话</button><small>最近对话</small>{hist.map(h=><div key={h.id}><button onClick={async()=>{if(busy)return;try{setMessages(await api('/conversations/'+h.id));setCid(h.id);setProgress({});setSources([])}catch(e:any){setNotice(e.message)}}}>{h.title}</button><button title="删除对话" onClick={async()=>{if(busy)return;await api('/conversations/'+h.id,{method:'DELETE'});setHist(v=>v.filter(x=>x.id!==h.id));if(h.id===cid){setMessages([]);setCid(undefined)}}}><Trash2 size={13}/></button></div>)}</aside>}
 <div className={'chat-main '+(!agent&&!compact&&!messages.length?'dot-hero':'')}>{!agent&&!compact&&!messages.length&&<DotHands/>}<div className="chat-context">{!compact&&<button className="history-toggle" title={historyOpen?'收起对话记录':'展开对话记录'} aria-label={historyOpen?'收起对话记录':'展开对话记录'} aria-expanded={historyOpen} aria-controls={historyId} onClick={()=>setHistoryOpen(v=>!v)}>{historyOpen?<PanelLeftClose size={17}/>:<PanelLeftOpen size={17}/>}</button>}<Sprout size={17}/>{plot?`正在关注：${plot.name} · ${plot.crop}`:(agent?names[agent]+'专业智能体':'农助 AI 总智能体')}{contextControl?<div className="chat-plot-control">{contextControl}</div>:<span>{agent?names[agent]:'智能协作'}</span>}</div>
 {!compact&&<details className="chat-service-scope"><summary>服务对象、知识范围与资料说明</summary><p>面向种植户、合作社经营者和农技学习者，用于田间管理、风险排查、销售及政策咨询。{agent?specialistCopy[agent]?.intro:'总问答覆盖农业问题，种植、病虫害、产业三个专业入口按各自范围服务。'}</p><p>依据来自农业知识库中已导入的官方资料、论文摘要和本地资料；需要外部检索时会单独列出网页来源。回答下可查看本轮检索资料，导入资料不等于已核实全文。无资料或证据不足时应明确说明，实时价格、政策与疑似病虫害需核验。</p><p>可连续追问、补充地区/作物/阶段；发现错误可点击“指出错误”，或通过“有误／不清楚”提交试用反馈。反馈仅用于本地记录，不会自动训练模型。</p></details>}
 <div className="chat-messages">{!messages.length&&<div className="chat-welcome"><div className="welcome-leaf"><Sprout size={32}/></div><h2>{agent?specialistCopy[agent]?.welcome:<><span className="hero-muted">土地的事，</span><span>我们一起想办法。</span></>}</h2><p>{agent?specialistCopy[agent]?.intro:'从一株幼苗，到一次丰收。告诉我您正在关心什么。'}</p>{!agent&&!compact&&<div className="hero-cta"><button onClick={e=>e.currentTarget.closest('.chat-main')?.querySelector<HTMLTextAreaElement>('textarea')?.focus()}>开始农业对话 <ArrowUp size={14}/></button></div>}<div className="suggestions">{(agent?specialistCopy[agent]?.suggestions:['如何安排本周农事？','叶片发黄，需要观察什么？','帮我写一段农产品宣传文案']).map(s=><button key={s} onClick={()=>send(s)}>{s}<ArrowUp size={14}/></button>)}</div></div>}
 {messages.map((m,i)=><div key={i} className={'message '+m.role+(m.error?' error':'')}><small>{m.role==='user'?'我':'农助 AI'}</small><div>{m.content||(busy?'正在分析任务…':'')}</div>{m.role==='assistant'&&<AnswerMedia media={m.media} onOpen={setVideoPopup}/>} {m.role==='assistant'&&m.content&&!busy&&<footer><button title="复制回答" onClick={()=>navigator.clipboard.writeText(m.content)}><Copy size={13}/></button><button title={speakingIndex===i?'停止播报':'语音播报'} aria-label={speakingIndex===i?'停止播报':'语音播报'} aria-pressed={speakingIndex===i} onClick={()=>toggleSpeaking(i,m.content)}>{speakingIndex===i?<Square size={14}/>:<Volume2 size={14}/>}</button>{m.id&&<button title="回答有帮助" onClick={async()=>{try{await api('/feedback',{method:'POST',body:JSON.stringify({message_id:m.id,rating:1})});setNotice('已保存您的反馈')}catch(e:any){setNotice(e.message)}}}><ThumbsUp size={13}/>有帮助</button>}{m.id&&<button title="回答有误或不清楚" onClick={()=>{setFeedbackTarget(m.id);setFeedbackText('')}}><ThumbsDown size={13}/>有误／不清楚</button>}<button title="指出错误并继续追问" onClick={()=>{setInput('请核对你刚才这段回答：'+m.content.slice(0,500)+'\n我认为有误的地方是：');setNotice('请补充错误点或依据后发送，AI 会结合上下文重新分析。')}}>指出错误</button><button title="重新分析" onClick={()=>send([...messages.slice(0,i)].reverse().find(x=>x.role==='user')?.content||'请重新分析')}><RotateCcw size={13}/></button>{plot&&<button onClick={async()=>{try{const due=new Date().toLocaleDateString('en-CA');await api('/tasks',{method:'POST',body:JSON.stringify({plot_id:plot.id,title:m.content.slice(0,6000),due,kind:'AI 管理计划'})});setNotice('已保存到地块管理计划，请在执行前审核建议')}catch(e:any){setNotice(e.message)}}}>保存为管理计划</button>}</footer>}{m.role==='assistant'&&m.id&&!m.error&&<AnswerSources sources={m.sources}/>}</div>)}
 {Object.keys(progress).length>0&&<div className="agent-progress">{Object.entries(progress).map(([k,v])=><span key={k}>{v==='completed'?<Check size={13}/>:v==='failed'?<X size={13}/>:<Loader2 size={13} className="spin"/>}{names[k]} · {v==='completed'?'完成':v==='failed'?'失败':'分析中'}</span>)}</div>}
 {questions.length>0&&!busy&&<div className="follow-up"><b>补充信息，继续分析</b>{questions.map(q=><label key={q}><input type="checkbox" checked={choices.includes(q)} onChange={e=>setChoices(c=>e.target.checked?[...c,q]:c.filter(x=>x!==q))}/>{q}</label>)}<button className="outline" disabled={!choices.length} onClick={()=>setInput('我来补充以下信息：\n'+choices.map(q=>q+'：').join('\n'))}>选择问题并填写补充</button></div>}
<div ref={bottom}/></div>
 <div className="chat-compose">{feedbackTarget&&<form className="answer-feedback" onSubmit={async e=>{e.preventDefault();try{await api('/feedback',{method:'POST',body:JSON.stringify({message_id:feedbackTarget,rating:-1,comment:feedbackText})});setNotice('已保存反馈，谢谢。可使用“指出错误”继续纠正本次回答。');setFeedbackTarget(undefined)}catch(e:any){setNotice(e.message)}}}><label>哪些内容有误或不清楚？<textarea aria-label="回答反馈" maxLength={2000} value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} placeholder="可填写错误点、依据或使用建议（选填）"/></label><button type="submit">保存反馈</button><button type="button" onClick={()=>setFeedbackTarget(undefined)}>取消</button></form>}{notice&&<p className="notice" role="status">{notice}</p>}{attachment&&<div className="attachment">{attachment.mime.startsWith('image')?<img src={attachment.url} alt="待分析图片"/>:<video src={attachment.url} controls/>}<span>{attachment.name}</span>{attachment.mime.startsWith('video/')&&<button type="button" disabled={busy} onClick={async()=>{try{setNotice('正在本机提取关键帧…');const result=await api('/uploads/'+attachment.id+'/frames');setAttachment((a:any)=>a?.id===attachment.id?{...a,frames:result.frames}:a);setNotice(result.notice)}catch(e:any){setNotice(e.message)}}}>提取关键帧</button>}<button title="移除附件" onClick={()=>setAttachment(undefined)}><X size={15}/></button></div>}{attachment?.frames?.length>0&&<div className="video-frames">{attachment.frames.map((f:any)=><figure key={f.seconds}><img src={apiUrl(f.url)} alt={`视频 ${f.seconds} 秒抽样画面`}/><figcaption>{f.seconds} 秒</figcaption></figure>)}</div>}{attachment&&<label className="consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>同意将此图片或视频抽样画面发送至配置的第三方图像模型分析</label>}
 <form onSubmit={e=>{e.preventDefault();send()}}><textarea aria-label="输入农业问题" placeholder={plot?`关于${plot.name}，您想了解什么？`:'向农助 AI 提问…'} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send()}}}/><div className="compose-tools"><div><label title="上传本地图片或视频"><ImagePlus size={18}/><input hidden type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={e=>{if(e.target.files?.[0])upload(e.target.files[0]);e.target.value=''}}/></label><button type="button" title="语音输入" onClick={speech.start} className={speech.listening?'recording':''}><Mic size={18}/></button>{speaking&&<button type="button" title="停止播报" onClick={stopSpeaking}><Square size={16}/></button>}</div>{busy?<button type="button" className="send" title="停止生成" onClick={()=>abort.current?.abort()}><Square size={15}/></button>:<button type="submit" className="send" title="发送问题" disabled={!input.trim()}><ArrowUp size={18}/></button>}</div></form><small>AI 建议仅供辅助参考，重要农事请结合实地情况和专业意见。</small></div></div></div>
}

function sourceWebsite(value:string){
 try{
  const url=new URL(value);if(!['http:','https:'].includes(url.protocol))return null;
  const host=url.hostname.toLowerCase().replace(/^www\./,'');
  const sites:Record<string,string>={'moa.gov.cn':'农业农村部','gov.cn':'中国政府网','caas.cn':'中国农业科学院','hebau.edu.cn':'河北农业大学','cau.edu.cn':'中国农业大学','njau.edu.cn':'南京农业大学','nwafu.edu.cn':'西北农林科技大学','weather.com.cn':'中国天气网','cma.gov.cn':'中国气象局','open-meteo.com':'Open-Meteo','doi.org':'DOI 论文来源','nature.com':'Nature','sciencedirect.com':'ScienceDirect','cnki.net':'中国知网'};
  // Most specific matching domain wins, e.g. ministry before gov.cn.
  const domain=Object.keys(sites).sort((a,b)=>b.length-a.length).find(d=>host===d||(d!=='gov.cn'&&host.endsWith('.'+d)));
  return {url:url.href,name:domain?sites[domain]:host};
 }catch{return null}
}
function AnswerSources({sources}:{sources?:any[]|string}){
 let items:any[]=[];try{const parsed=typeof sources==='string'?JSON.parse(sources):sources;items=Array.isArray(parsed)?parsed:[]}catch{}
 return <details className="answer-sources"><summary>回答依据 · 来源网站</summary>{items.length?items.map((source,i)=>{const site=sourceWebsite(source.source||'');return <div key={i}>{site?<><a href={site.url} target="_blank" rel="noreferrer">[{source.citation||i+1}] {site.name} ↗</a><small>{source.name}</small></>:<><b>[{source.citation||i+1}] 本地知识库</b><p>{source.name}{source.source?' · '+source.source:''}</p></>}</div>}):<p>本轮未附网页来源，暂无可显示的网站名称。旧对话可能未保存来源。</p>}</details>;
}

function AnswerMedia({media,onOpen}:{media?:any[]|string;onOpen:(video:{url:string;title:string;type?:string})=>void}){
 let list:any[]=[];try{const data=typeof media==='string'?JSON.parse(media):media;list=Array.isArray(data)?data:[]}catch{}
 return <>{list.filter(v=>v.type==='video'&&v.url==='/api/media/li-baoguo'||v.type==='image'&&/^\/api\/media\/crops\/\d{2}$/.test(v.url)).map((video,i)=><div className="answer-video" key={i}>{video.type==='image'?<img className="answer-crop-image" src={apiUrl(video.url)} alt={video.title} onClick={()=>onOpen({...video,url:apiUrl(video.url)})}/>:<video src={apiUrl(video.url)} controls playsInline preload="metadata"/>}<button onClick={()=>onOpen({...video,url:apiUrl(video.url)})}>{video.type==='image'?'查看图片':'打开视频'} · {video.title}</button></div>)}</>;
}
