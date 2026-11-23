import {useEffect,useRef,useState} from 'react';

const SOURCE='https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261030_025250_100df7b8-31fd-4614-aa4a-c1b7d5b6b273.png&w=1600&q=85';
const RECTS=[[0,.06,.47,.40],[.53,.06,.47,.40],[0,.55,.47,.40],[.53,.55,.47,.40]];
const hash=(a:number,b:number)=>{const v=Math.sin(a*127.1+b*311.7)*43758.5453;return v-Math.floor(v)};
const smooth=(a:number,b:number,x:number)=>{const v=Math.max(0,Math.min(1,(x-a)/(b-a)));return v*v*(3-2*v)};
const mix=(t:number,on:number,off:number)=>smooth(on,on+1.6,t)*(1-smooth(off,off+1.6,t));

/** Live luminance halftone; source tiles are never displayed as background images. */
export default function DotHands(){
 const ref=useRef<HTMLCanvasElement>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const fields=[document.createElement('canvas'),document.createElement('canvas')];
  const contexts=fields.map(f=>f.getContext('2d',{willReadFrequently:true}));
  if(!contexts[0]||!contexts[1])return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let tiles:HTMLCanvasElement[]=[],width=0,height=0,cols=0,rows=0,step=5,rowStep=10,seeds=new Float32Array(),frame=0,disposed=false,visible=true,last=-1;
  const started=performance.now();
  function resize(){
   if(!canvas||!ctx)return;const box=canvas.getBoundingClientRect();width=box.width;height=box.height;
   const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
   step=Math.max(width<600?6:5,width/205);rowStep=step*2.05;cols=Math.ceil(width/step);rows=Math.ceil(height/rowStep);
   fields.forEach(f=>{f.width=cols;f.height=rows});seeds=new Float32Array(cols*rows);
   for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)seeds[j*cols+i]=.55*hash(i,j)+.45*hash(j*3.1,7.7);
   if(tiles.length)render(reduced.matches?0:(performance.now()-started)/1000);
  }
  function render(time:number){
   if(!ctx||!width||!height||tiles.length!==4)return;
   const t=((time%20)+20)%20,a=Math.PI*2*t/20,portrait=height>width,hw=width*(portrait?.66:.53),hh=hw*(.40*1520)/(.47*2688),cy=height*(portrait?.66:.54);
   for(let pose=0;pose<2;pose++){
    const field=contexts[pose]!;field.setTransform(1,0,0,1,0,0);field.fillStyle='#fff';field.fillRect(0,0,cols,rows);
    for(let side=0;side<2;side++){
     const ph=side?Math.PI:0,reach=(.035*Math.sin(a+ph)+.012*Math.sin(2*a+1.3+ph))*width;
     const x=side?width-hw+width*.045-reach:reach-width*.045,pivot=side?width:0;
     const scale=1+.07*Math.sin(a+.9+ph),rot=(side?-1:1)*.045*Math.sin(a+2.1+ph);
     field.save();field.scale(cols/width,rows/height);field.translate(pivot,cy);field.rotate(rot);field.scale(scale,scale);field.translate(-pivot,-cy);field.drawImage(tiles[pose*2+side],x,cy-hh/2,hw,hh);field.restore();
    }
   }
   const data=contexts.map(c=>c!.getImageData(0,0,cols,rows).data),mL=mix(t,6.2,14.6),mR=mix(t,2.4,10.4),tick=Math.floor(t*7);
   ctx.clearRect(0,0,width,height);ctx.fillStyle='#0d0d0d';
   const paths=[new Path2D(),new Path2D(),new Path2D(),new Path2D()];
   for(let j=0;j<rows;j++){
    const shift=hash(j,tick)>.965?Math.round((hash(tick,j)-.5)*8):0;
    for(let i=0;i<cols;i++){
     const seed=seeds[j*cols+i],m=i<cols/2?mL:mR,sample=Math.max(0,Math.min(cols-1,i-shift)),lum=data[seed<m?1:0][(j*cols+sample)*4]/255;
     let v=Math.max(0,Math.min(1,(1-lum-.16)/.42));
     v*=.86+.14*Math.sin(t*3.2+seed*40);
     const cx=Math.abs((i+.5)/cols-.5);v*=smooth(.035,.11,cx);
     v*=smooth(.85,1.25,Math.hypot(cx/(portrait?.44:.2),((j+.5)*rowStep/height-(portrait?.33:.385))/.085));
     if(m>.001&&m<.999&&Math.abs(seed-m)<.12){v*=Math.abs(seed-m)/.12;if(hash(i+tick,j)<=.4)v*=.3}
     let level=-1;for(let k=0;k<4;k++)if(v>=[.26,.52,.78,1][k]-.13)level=k;
     if(level<0)continue;const r=step*.46*[.38,.52,.78,1][level],x=(i+.5)*step,y=(j+.5)*rowStep;
     paths[level].moveTo(x+r,y);paths[level].arc(x,y,r,0,Math.PI*2);
    }
   }
   paths.forEach(p=>ctx.fill(p));
  }
  function animate(now:number){if(disposed)return;if(visible&&!document.hidden&&now-last>=(width<600?50:33)){try{render((now-started)/1000);last=now}catch{setFailed(true);return}}frame=requestAnimationFrame(animate)}
  function play(){cancelAnimationFrame(frame);if(reduced.matches){render(0)}else frame=requestAnimationFrame(animate)}
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true});intersection.observe(canvas);
  const image=new Image();image.crossOrigin='anonymous';
  image.onload=()=>{if(disposed)return;try{tiles=RECTS.map(([x,y,w,h])=>{const tile=document.createElement('canvas');tile.width=420;tile.height=Math.round(420*(image.naturalHeight*h)/(image.naturalWidth*w));const c=tile.getContext('2d')!;c.imageSmoothingQuality='high';c.drawImage(image,image.naturalWidth*x,image.naturalHeight*y,image.naturalWidth*w,image.naturalHeight*h,0,0,tile.width,tile.height);return tile});resize();play()}catch{setFailed(true)}};
  image.onerror=()=>{if(!disposed)setFailed(true)};image.src=SOURCE;
  reduced.addEventListener('change',play);
  // Optional deterministic capture hook, scoped to this mounted illustration.
  const capture=window as Window&{__render?:(t:number)=>void};capture.__render=render;
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();reduced.removeEventListener('change',play);image.onload=null;image.onerror=null;if(capture.__render===render)delete capture.__render;fields.forEach(f=>{f.width=0;f.height=0});tiles=[]};
 },[]);
 return <canvas ref={ref} className={'dot-hands '+(failed?'unavailable':'')} aria-hidden="true"/>;
}
