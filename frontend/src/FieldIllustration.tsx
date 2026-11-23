import {useMemo} from 'react';
import type {Slot} from './Garden';
import {seasonPalette,seasonNames,weatherNames,climateNames,disasterNames,type Weather,type Season,type Climate,type Disaster,type Pest} from './FarmSimulation';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
/** CPU-only state illustration: works even when WebGL is unavailable. */
export default function FieldIllustration({slot,weather,season,climate,disaster,pest,hour,area}:{slot:Slot;weather:Weather;season:Season;climate:Climate;disaster:Disaster;pest?:Pest;hour:number;area:number}){
 const bucket=Math.floor(hour*4);
 const src=useMemo(()=>{
 const night=hour<6||hour>=19,palette=seasonPalette[season],green=slot.water<20?'#a99b52':slot.progress>=78?'#d1ad40':palette.crop;
 const ground=disaster==='drought'||climate==='hot'?'#bb9856':season==='winter'?'#e6eff8':palette.ground;
 const crop=escape(slot.crop||'待播种'),height=12+Math.min(1,slot.progress/100)*38;
 let content='';
 for(let i=0;i<7;i++)content+=`<path d="M ${90+i*44} 275 L ${155+i*34} 190" stroke="#60402c" stroke-width="5" opacity=".55"/>`;
 if(slot.crop)for(let row=0;row<4;row++)for(let col=0;col<7;col++){
 const x=126+col*33+row*9,y=269-row*21;
 content+=`<g transform="translate(${x} ${y})"><path d="M0 0V-${height}" stroke="${green}" stroke-width="4"/><path d="M0 -10Q-22 -36 -17 -17Q-7 -12 0 -10M0 -20Q21 -42 18 -23Q8 -19 0 -20" fill="${green}"/>`;
 if(slot.crop==='小麦'||slot.crop==='玉米')content+=`<ellipse cy="-${height}" rx="5" ry="11" fill="${slot.progress>70?'#eacb67':green}"/>`;
 else content+=`<circle cx="7" cy="-${height*.65}" r="${slot.crop==='南瓜'?9:5}" fill="${slot.crop==='番茄'?'#db5944':slot.crop==='胡萝卜'?'#e78c37':'#e3a343'}"/>`;
 content+='</g>';
 }
 if(disaster==='flood')content+='<path d="M76 240L256 152L423 230L241 317Z" fill="#55aaca" opacity=".7"/>';
 if(disaster==='drought')for(let i=0;i<12;i++)content+=`<path d="M${110+i*23} 282l7 -17 -6 -10 12 -12" fill="none" stroke="#70482a" stroke-width="2"/>`;
 if(weather==='rain'||weather==='snow'||disaster==='hail')for(let i=0;i<85;i++){
 const x=55+(i*73)%380,y=50+(i*47)%230;
 content+=weather==='rain'&&disaster!=='hail'?`<path d="M${x} ${y}l-5 17" stroke="#b9dfff" stroke-width="2"/>`:`<circle cx="${x}" cy="${y}" r="${disaster==='hail'?4:2.5}" fill="#fff"/>`;
 }
 if(disaster==='wind')for(let i=0;i<10;i++)content+=`<path d="M${30+i*17} ${90+i*16}q80 -16 145 0" fill="none" stroke="#eee7d2" stroke-width="3"/>`;
 if(pest)for(let i=0;i<Math.round(4+pest.severity/12);i++){
 const x=135+(i*53)%220,y=190+(i*29)%85;
 content+=pest.kind==='insects'?`<g transform="translate(${x} ${y})"><path d="M-9 -5L9 5M-9 5L9 -5M-10 0H10" stroke="#342819" stroke-width="2"/><ellipse rx="4" ry="7" fill="#554323"/></g>`:`<circle cx="${x}" cy="${y}" r="7" fill="#a9532d"/>`;
 }
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 340"><rect width="480" height="340" fill="${night?'#1b2c47':weather==='rain'?'#92a9b8':palette.sky}"/><circle cx="390" cy="58" r="24" fill="${night?'#e0e8f2':'#ffe5a0'}"/><path d="M45 220L245 125L440 217L240 327Z" fill="#66513a"/><path d="M45 207L245 112L440 204L240 314Z" fill="${ground}"/><path d="M83 221L253 141L410 214L240 296Z" fill="${season==='winter'?'#c3d4dc':'#926744'}"/>${content}${night?'<rect width="480" height="340" fill="#12223a" opacity=".25"/>':''}<rect x="12" y="12" width="310" height="58" rx="8" fill="white" opacity=".9"/><g font-family="system-ui,sans-serif" fill="#304637"><text x="23" y="36" font-size="16">体验田 ${String(slot.id).padStart(2,'0')} · ${crop}</text><text x="23" y="56" font-size="11">${seasonNames[season]} · ${weatherNames[weather]} · ${climateNames[climate]} · ${disasterNames[disaster]} · 面积 ${area}×</text></g></svg>`;
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
 },[slot.id,slot.crop,Math.round(slot.progress),Math.round(slot.water),weather,season,climate,disaster,pest?.kind,pest?.severity,bucket,area]);
 return <img src={src} alt={`体验田${slot.id}状态示意图：${slot.crop||'空地'}，${weatherNames[weather]}，${seasonNames[season]}，${disasterNames[disaster]}${pest?'，含病虫害标记':''}`}/>;
}
