import {useState} from 'react';
import {Beaker,Shovel,Droplets,Scissors,Sprout,Save,RotateCcw} from 'lucide-react';

const tools=[
 {name:'手铲',Icon:Shovel,description:'用于移栽、挖穴和小范围松土。',care:'使用后清理泥土，擦干后存放；检查铲头与手柄是否牢固。'},
 {name:'浇水壶',Icon:Droplets,description:'用于幼苗和盆栽的定点浇水。',care:'根据土壤实际湿润程度安排浇水，清理喷头并排空余水。'},
 {name:'修枝剪',Icon:Scissors,description:'用于细枝修剪与清理枯枝。',care:'修剪前后清洁刀刃，不同植株间按需消毒，收纳时合拢锁扣。'},
 {name:'育苗盘',Icon:Sprout,description:'用于分格育苗，便于观察出苗与移栽。',care:'保持排水孔畅通，重复使用前清洁消毒，记录作物和播种日期。'},
 {name:'量杯',Icon:Beaker,description:'用于读取液体体积，辅助核对配制用量。',care:'农药专用量具应清晰标识、单独保管，禁止用于食品或饮水。'},
];

export default function Workbench({onSaveTask}:{onSaveTask:(text:string)=>void}){
 const [tab,setTab]=useState<'tools'|'mix'>('tools'),[chosen,setChosen]=useState(0);
 const [volume,setVolume]=useState(''),[ratio,setRatio]=useState(''),[product,setProduct]=useState('');
 const [calculation,setCalculation]=useState<{volume:number;ratio:number;product:string}>();
 const [error,setError]=useState('');
 const tool=tools[chosen];
 const result=calculation?{liquid:calculation.volume*1000/calculation.ratio,water:calculation.volume*(1-1/calculation.ratio)}:undefined;
 function reset(){setVolume('');setRatio('');setProduct('');setCalculation(undefined);setError('')}
 return <div className="agri-workbench"><div className="page-heading"><div><div className="eyebrow">AGRICULTURE WORKBENCH</div><h1>我的农业工作台</h1><p>选择一件农具，或在配制台上核算标签用量。</p></div></div>
  <div className="bench-tabs" role="tablist" aria-label="工作台模式"><button id="tool-tab" role="tab" aria-selected={tab==='tools'} aria-controls="bench-tools" onClick={()=>setTab('tools')}><Shovel size={18}/> 农具展示</button><button id="mix-tab" role="tab" aria-selected={tab==='mix'} aria-controls="bench-mix" onClick={()=>setTab('mix')}><Beaker size={18}/> 配制计算</button></div>
  {tab==='tools'?<section id="bench-tools" role="tabpanel" aria-labelledby="tool-tab" className="bench-layout"><div className="bench-stage"><span className="bench-stage-label">农具陈列台 · 点击物品查看</span><div className="bench-tool-display"><tool.Icon size={120} strokeWidth={1.2}/><span>{tool.name}</span></div><div className="bench-surface"/><div className="bench-inventory">{tools.map((t,i)=><button key={t.name} aria-label={`查看${t.name}`} aria-pressed={i===chosen} className={i===chosen?'selected':''} onClick={()=>setChosen(i)}><t.Icon size={28}/><span>{t.name}</span></button>)}</div></div><aside className="panel bench-details" aria-live="polite"><span className="section-kicker">农具档案 / {String(chosen+1).padStart(2,'0')}</span><h2>{tool.name}</h2><p>{tool.description}</p><h3>使用与养护</h3><p>{tool.care}</p><button className="outline" onClick={()=>onSaveTask(`农具检查与养护：${tool.name}。${tool.care}`)}><Save size={16}/> 加入农事安排</button><small>此处为交互式图示陈列，不代表已连接真实设备。</small></aside></section>:<section id="bench-mix" role="tabpanel" aria-labelledby="mix-tab" className="bench-layout"><div className="panel bench-calculator"><h2><Beaker size={21}/> 液体制剂稀释计算</h2><p>按标签给出的稀释倍数核算单一液体制剂。此处倍数定义为：最终药液体积 ÷ 原制剂体积。</p><form onSubmit={e=>{e.preventDefault();const v=Number(volume),r=Number(ratio);if(!Number.isFinite(v)||v<=0||!Number.isFinite(r)||r<=1){setError('最终药液体积应大于 0，稀释倍数应大于 1。');setCalculation(undefined);return}setError('');setCalculation({volume:v,ratio:r,product:product.trim()})}}>
   <label>制剂名称（按标签填写，可选）<input value={product} maxLength={100} onChange={e=>{setProduct(e.target.value);setCalculation(undefined)}} placeholder="填写您实际使用的液体制剂名称"/></label>
   <div className="bench-inputs"><label>最终药液体积（升）<input required type="number" min="0.001" step="any" value={volume} onChange={e=>{setVolume(e.target.value);setCalculation(undefined)}} placeholder="请输入体积"/></label><label>标签稀释倍数（倍）<input required type="number" min="1.000001" step="any" value={ratio} onChange={e=>{setRatio(e.target.value);setCalculation(undefined)}} placeholder="请输入标签倍数"/></label></div><div className="bench-form-actions"><button className="primary" type="submit"><Beaker size={16}/> 计算用量</button><button className="outline" type="button" onClick={reset}><RotateCcw size={16}/> 重置</button></div>
  </form>{error&&<p role="alert">{error}</p>}
  <div className="bench-result" aria-live="polite">{result&&calculation?<><span>计算结果 · {calculation.product||'液体制剂'}</span><div><p><b>{Number(result.liquid.toPrecision(6))}</b> 毫升制剂</p><p>加水定容至 <b>{calculation.volume}</b> 升</p></div><small>按体积可加估算水量 {Number(result.water.toPrecision(6))} 升；实际以最终定容读数为准。未计密度与混合体积变化。</small><button className="outline" onClick={()=>onSaveTask(`核对配制计划：${calculation.product||'液体制剂'}，标签稀释 ${calculation.ratio} 倍，取制剂 ${Number(result.liquid.toPrecision(6))} 毫升，加水定容至 ${calculation.volume} 升。施用前核对登记作物、防治对象、标签用法与安全间隔期。`)}><Save size={16}/> 保存为待核对农事</button></>:<p>填写标签信息后，点击“计算用量”查看结果。</p>}</div></div>
  <aside className="panel bench-details"><span className="section-kicker">配制台说明</span><h2>先核对标签，再计算</h2><p>本工具只换算您输入的比例，不推荐药剂或施用浓度。</p><h3>适用范围</h3><p>仅适用于标签采用上述体积稀释倍数的单一液体制剂；粉剂、按亩用量、有效成分浓度及多药混配不适用。</p><h3>施用前核对</h3><p>确认登记作物、防治对象、施用方法和安全间隔期，按标签采取防护措施。计算结果不表示适合某个作物或可直接施用。</p></aside></section>}
 </div>
}
