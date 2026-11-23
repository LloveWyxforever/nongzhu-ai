import {useEffect,useMemo,useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Html,OrbitControls,PerspectiveCamera} from '@react-three/drei';
import * as THREE from 'three';
import {buildWheat,buildCorn,buildCarrot,buildTomato,buildPumpkin} from './referenceModels.js';
import {buildTextures} from './referenceTextures.js';
import type {Plot} from './api';
import {WeatherParticles,PestEffect,EnvironmentEffect,SeasonalScenery,seasonPalette,type Season,type Climate,type Disaster,type Weather,type Pest} from './FarmSimulation';

type Textures=ReturnType<typeof buildTextures>;
function Solid({position,size,color,map}:{position:[number,number,number];size:[number,number,number];color?:string;map?:THREE.Texture}){
 return <mesh position={position} castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color||'#ffffff'} map={map} roughness={.92}/></mesh>
}
function Crop({plot,position=[0,0,0],scale=1,phase=0,season='spring'}:{season?:Season;plot:Plot;position?:[number,number,number];scale?:number;phase?:number}){
 const pivot=useRef<THREE.Group>(null);
 const model=useMemo(()=>{
  const build=/玉米/.test(plot.crop)?buildCorn:/胡萝卜|萝卜/.test(plot.crop)?buildCarrot:/番茄|西红柿/.test(plot.crop)?buildTomato:/南瓜|瓜|蔬菜/.test(plot.crop)?buildPumpkin:buildWheat;
  const m=build();
  const progress:Record<string,number>={'幼苗期':.12,'生长期':.35,'开花期':.52,'抽穗期':.65,'灌浆期':.82,'成熟期':1};
  const p=progress[plot.stage]??.35,ripeT=THREE.MathUtils.clamp((p-.52)/.42,0,1);
  m.group.scale.setScalar(.28+1.12*Math.pow(p,.7));
  if(m.ears)m.ears.visible=p>.42;
  m.earMat?.color.copy(m.unripe).lerp(m.ripe,ripeT);
  m.fruitMat?.color.copy(m.unripe).lerp(m.ripe,ripeT);
  m.leafMats.forEach(mat=>{mat.color.copy(m.leafBase).lerp(m.leafRipe,ripeT);mat.color.lerp(new THREE.Color(seasonPalette[season].crop),season==='winter'?.8:.45);if(plot.status==='需关注')mat.color.lerp(new THREE.Color('#a89a70'),.4)});
  m.fruits.forEach(f=>{const k=THREE.MathUtils.clamp((p-f.at)/Math.max(.02,1-f.at),0,1);f.mesh.visible=k>.02;f.mesh.scale.multiplyScalar(.45+.55*k)});
  return m;
 },[plot.crop,plot.stage,plot.status,season]);
 useEffect(()=>()=>{const materials=new Set<THREE.Material>();model.group.traverse(o=>{if(o instanceof THREE.Mesh){const m=o.material;(Array.isArray(m)?m:[m]).forEach(mat=>materials.add(mat))}});materials.forEach(m=>m.dispose())},[model]);
 const reduced=useMemo(()=>matchMedia('(prefers-reduced-motion: reduce)').matches,[]);
 useFrame(({clock})=>{if(pivot.current&&!reduced)pivot.current.rotation.z=Math.sin(clock.elapsedTime*1.2+phase)*.016});
 return <group ref={pivot} position={position} scale={scale}><primitive object={model.group} dispose={null}/></group>
}
function Fence({width,depth,textures}:{width:number;depth:number;textures:Textures}){
 return <group>{[-1,1].map(dir=><group key={dir}>
  {Array.from({length:7},(_,i)=><Solid key={'x'+i} position={[-width/2+i*width/6,.39,dir*depth/2]} size={[.09,.65,.09]} map={textures.wood}/>)}
  {[.28,.56].map(y=><Solid key={'xr'+y} position={[0,y,dir*depth/2]} size={[width,.045,.065]} map={textures.wood}/>)}
  {Array.from({length:5},(_,i)=><Solid key={'z'+i} position={[dir*width/2,.39,-depth/2+i*depth/4]} size={[.09,.65,.09]} map={textures.wood}/>)}
  {[.28,.56].map(y=><Solid key={'zr'+y} position={[dir*width/2,y,0]} size={[.065,.045,depth]} map={textures.wood}/>)}
 </group>)}</group>
}
function Props({width,depth,textures}:{width:number;depth:number;textures:Textures}){
 return <group>
  <group position={[width/2-.48,.31,-depth/2+.48]}>
   <mesh castShadow><cylinderGeometry args={[.24,.27,.46,14]}/><meshStandardMaterial map={textures.wood} roughness={.86}/></mesh>
   {[-.14,.14].map(y=><mesh key={y} position={[0,y,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.253,.016,5,16]}/><meshStandardMaterial color="#6c6558" metalness={.6} roughness={.5}/></mesh>)}
   <mesh position={[0,.235,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.214,20]}/><meshStandardMaterial color="#7dabb2" roughness={.28}/></mesh>
  </group>
  <group position={[-width/2+.5,.23,depth/2-.45]} rotation={[0,.45,0]}>
   <mesh castShadow><cylinderGeometry args={[.15,.195,.3,14]}/><meshStandardMaterial color="#5f7d6c" metalness={.3} roughness={.44}/></mesh>
   <mesh position={[.23,.06,0]} rotation={[0,0,-1]}><cylinderGeometry args={[.025,.045,.37,8]}/><meshStandardMaterial color="#5f7d6c"/></mesh>
   <mesh position={[-.19,.04,0]} rotation={[0,Math.PI/2,0]}><torusGeometry args={[.12,.02,6,14]}/><meshStandardMaterial color="#5f7d6c"/></mesh>
  </group>
  {Array.from({length:26},(_,i)=>{const side=i%4,along=((i*37)%97)/97;const x=side<2?(-width/2+.2+along*(width-.4)):(side===2?-1:1)*(width/2-.16);const z=side<2?(side===0?-1:1)*(depth/2-.18):(-depth/2+.2+along*(depth-.4));return <group key={i} position={[x,.1,z]}><mesh position={[0,.07,0]} rotation={[0,i,0]} castShadow><coneGeometry args={[.035,.20,4]}/><meshStandardMaterial color="#6d8a45"/></mesh>{i%3===0&&<mesh position={[.1,-.01,0]} scale={[1.2,.65,1]}><dodecahedronGeometry args={[.07,0]}/><meshStandardMaterial color="#9a9585" roughness={1}/></mesh>}</group>})}
 </group>
}
function Patch({plot,x,z,selected,textures,onEnter,detail=false,layoutScale=1,season='spring'}:{layoutScale?:number;season?:Season;plot:Plot;x:number;z:number;selected:boolean;textures:Textures;onEnter:(p:Plot)=>void;detail?:boolean}){
 const [hover,setHover]=useState(false);
 const size=(detail?3.7:1.75)*layoutScale;
 return <group position={[x,0,z]} onClick={e=>{e.stopPropagation();if(e.delta<=5&&!detail){document.body.style.cursor='auto';onEnter(plot)}}} onPointerOver={e=>{e.stopPropagation();if(!detail){setHover(true);document.body.style.cursor='pointer'}}} onPointerOut={()=>{setHover(false);document.body.style.cursor='auto'}}>
  <Solid position={[0,.13,0]} size={[size+.16,.12,size+.16]} color={selected||hover?'#b99a56':'#6d4e33'}/>
  <Solid position={[0,.215,0]} size={[size,.13,size]} map={textures.tilled} color={plot.status==='需关注'?'#d9c49a':'#ffffff'}/>
  {Array.from({length:detail?7:5},(_,i)=><mesh key={i} position={[-size*.4+i*size*.8/(detail?6:4),.285,0]} rotation={[Math.PI/2,0,0]} receiveShadow><cylinderGeometry args={[.035,.06,size-.14,7]}/><meshStandardMaterial color="#60472f" roughness={1}/></mesh>)}
  {plot.crop!=='待播种'&&(detail?[-1,0,1].flatMap((row)=>[-1,0,1].map(col=><Crop season={season} key={row+','+col} plot={plot} position={[row*1.04*layoutScale,.29,col*1.04*layoutScale]} scale={/稻|麦/.test(plot.crop)?.5:.74} phase={row*2+col}/>)):<Crop season={season} plot={plot} position={[0,.29,0]} scale={.85} phase={plot.id}/>)}
  {!detail&&<Html position={[0,.2,size*.5+.08]} center zIndexRange={[1,0]} style={{pointerEvents:'none'}}><div className={'plot-label reference-label '+(selected?'selected':'')}>{plot.name}<span>{plot.crop} · {plot.stage}{!/小麦|玉米|胡萝卜|萝卜|番茄|西红柿|南瓜|瓜/.test(plot.crop)?' · 通用示意':''}</span></div></Html>}
  {(selected||hover)&&!detail&&<mesh position={[0,.30,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[size*.48,size*.5,48]}/><meshBasicMaterial color="#f8df8e" transparent opacity={.7} depthWrite={false}/></mesh>}
 </group>
}
function daylight(hour:number){return Math.max(0,Math.sin((hour-6)/12*Math.PI))}
function Sky({weather,season,hour}:{weather:Weather;season:Season;hour:number}){
 const light=daylight(hour),twilight=Math.max(0,1-Math.abs(light-.12)*5)*(hour>4&&hour<20?1:0);
 const top=new THREE.Color('#08152d').lerp(new THREE.Color(weather==='sunny'?seasonPalette[season].sky:'#788b9e'),light);
 const horizon=new THREE.Color('#182644').lerp(new THREE.Color('#e5edf1'),light).lerp(new THREE.Color('#f29a60'),twilight*.8);
 const texture=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=8;canvas.height=128;const ctx=canvas.getContext('2d')!;const g=ctx.createLinearGradient(0,0,0,128);g.addColorStop(0,'#'+top.getHexString());g.addColorStop(.65,'#'+horizon.getHexString());g.addColorStop(1,'#'+horizon.getHexString());ctx.fillStyle=g;ctx.fillRect(0,0,8,128);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t},[top.getHexString(),horizon.getHexString()]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 const angle=(hour-6)/12*Math.PI;
 return <><mesh><sphereGeometry args={[90,24,16]}/><meshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} fog={false} toneMapped={false}/></mesh>
 <mesh position={[Math.cos(angle)*48,Math.sin(angle)*48,-25]}><sphereGeometry args={[2,16,12]}/><meshBasicMaterial color={light<.25?'#ffb86b':'#fff6ce'} fog={false} toneMapped={false}/></mesh>
 <mesh position={[-Math.cos(angle)*48,-Math.sin(angle)*48,-25]}><sphereGeometry args={[1.35,16,12]}/><meshBasicMaterial color="#d8e6fc" fog={false} toneMapped={false}/></mesh>
 {light<.15&&<group>{Array.from({length:75},(_,i)=><mesh key={i} position={[Math.sin(i*7.13)*65,15+(i*13.7)%50,Math.cos(i*4.77)*65]}><sphereGeometry args={[.07+(i%3)*.03,4,3]}/><meshBasicMaterial color="#e0ebff" fog={false} toneMapped={false}/></mesh>)}</group>}</>;
}
function WaterEffect(){
 const group=useRef<THREE.Group>(null),start=useRef<number|undefined>(undefined);
 useFrame(({clock})=>{if(!group.current)return;start.current??=clock.elapsedTime;const t=clock.elapsedTime-start.current;group.current.visible=t<2.4;group.current.children.forEach((drop,i)=>{drop.position.set(Math.sin(i*2.4)*1.4,2.8-((t*1.8+i*.13)%2.8),Math.cos(i*2.4)*1.4)})});
 return <group ref={group}>{Array.from({length:28},(_,i)=><mesh key={i}><sphereGeometry args={[.035,5,4]}/><meshBasicMaterial color="#9bd8ed"/></mesh>)}</group>
}
export default function ReferenceScene({plots,selected,onSelect,control,detail,effect,reclaim=false,onReclaim,weather='sunny',pests=[],hour=12,areaMultiplier=1,season='spring',climate='temperate',disaster='none',snapshot=false}:{plots:Plot[];selected?:number;onSelect:(p:Plot)=>void;control:{current:any};detail?:Plot;effect?:{slot:number;kind:string;key:number};reclaim?:boolean;onReclaim?:()=>void;weather?:Weather;pests?:Pest[];hour?:number;areaMultiplier?:number;season?:Season;climate?:Climate;disaster?:Disaster;snapshot?:boolean}){
 const textures=useMemo(buildTextures,[]);
 useEffect(()=>()=>Object.values(textures).forEach(t=>t.dispose()),[textures]);
 const {width:screenWidth,height:screenHeight}=useThree(s=>s.size);
 const cols=4,rows=Math.max(4,Math.ceil((plots.length+(reclaim?1:0))/cols));
 const layoutScale=Math.sqrt(areaMultiplier);
 const width=(detail?6.4:11.4)*layoutScale,depth=(detail?6.4:Math.max(11.4,rows*2.3+2.2))*layoutScale;
 const aspect=screenWidth/Math.max(1,screenHeight),fov=38*Math.PI/180;
 const radius=Math.max(12,Math.max(width,depth)*.72/Math.tan(fov/2)/Math.min(1,aspect));
 const light=daylight(hour),angle=(hour-6)/12*Math.PI;
 const cameraPosition:[number,number,number]=[-radius*.48,radius*.62,radius*.60];
 return <>
  <PerspectiveCamera makeDefault fov={38} position={cameraPosition} near={.1} far={220}/>
  <fog attach="fog" args={[weather==='rain'?'#8496a3':weather==='snow'?'#dce6ec':'#e9dcc3',radius+(weather==='sunny'?18:7),radius+(weather==='sunny'?55:35)]}/><Sky weather={weather} season={season} hour={hour}/>
  <hemisphereLight args={['#bcd8ff','#554636',.22+light*.58]}/>
  <directionalLight position={[Math.cos(angle)*18,Math.max(.2,Math.sin(angle)*18),6.5]} color={light<.3?'#ffaf73':seasonPalette[season].light} intensity={light*(weather==='sunny'?3.5:weather==='rain'?.9:1.5)} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-width} shadow-camera-right={width} shadow-camera-top={depth} shadow-camera-bottom={-depth} shadow-bias={-.0007} shadow-normalBias={.02}/>
  <directionalLight position={[7,4.5,-6.5]} color="#bcd6ff" intensity={.2+light*.3}/>
  <Solid position={[0,-.65,0]} size={[width,1.3,depth]} map={textures.soil}/>
  <Solid position={[0,.055,0]} size={[width+.14,.16,depth+.14]} map={textures.grass} color={weather==='snow'?'#e4ebdf':climate==='hot'?'#c5a05c':climate==='cold'?'#cddfe8':climate==='humid'?'#488c56':seasonPalette[season].ground}/>
  <Fence width={width-.32} depth={depth-.32} textures={textures}/><Props width={width-.32} depth={depth-.32} textures={textures}/>
  {detail?<Patch layoutScale={layoutScale} season={season} plot={detail} x={0} z={0} selected textures={textures} onEnter={onSelect} detail/>:plots.map((plot,i)=><Patch layoutScale={layoutScale} season={season} key={plot.id} plot={plot} x={(i%cols-(cols-1)/2)*2.3*layoutScale} z={(Math.floor(i/cols)-(rows-1)/2)*2.3*layoutScale} selected={plot.id===selected} textures={textures} onEnter={onSelect}/>)}
  {reclaim&&!detail&&<group position={[(plots.length%cols-(cols-1)/2)*2.3*layoutScale,.19,(Math.floor(plots.length/cols)-(rows-1)/2)*2.3*layoutScale]} onClick={e=>{e.stopPropagation();if(e.delta<=5)onReclaim?.()}}>
   <mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2.05*layoutScale,2.05*layoutScale]}/><meshStandardMaterial color="#e9bb55" transparent opacity={.75} emissive="#bb8c22" emissiveIntensity={.25}/></mesh>
   <Html position={[0,.25,0]} center zIndexRange={[2,0]}><button className="reclaim-land-label" onClick={onReclaim}>＋ 开垦空地 {plots.length+1}</button></Html>
  </group>}
  {!detail&&<><Solid position={[0,.15,0]} size={[.35,.025,depth-1]} color="#c5b48d"/><Solid position={[0,.15,0]} size={[width-1,.025,.35]} color="#c5b48d"/></>}
  {(weather==='rain'||weather==='snow')&&<WeatherParticles key={weather} weather={weather} width={width} depth={depth}/>}
  {pests.filter(pest=>plots.some(p=>p.id===pest.plotId)&&(!detail||detail.id===pest.plotId)).map(pest=><PestEffect key={pest.plotId} pest={pest} snapshot={snapshot} detail={!!detail} layoutScale={layoutScale} x={detail?0:(plots.findIndex(p=>p.id===pest.plotId)%cols-(cols-1)/2)*2.3*layoutScale} z={detail?0:(Math.floor(plots.findIndex(p=>p.id===pest.plotId)/cols)-(rows-1)/2)*2.3*layoutScale}/>)}
  {effect?.kind==='water'&&detail?.id===effect.slot&&<WaterEffect key={effect.key}/>}
  <SeasonalScenery season={season} width={width} depth={depth}/>
  <EnvironmentEffect climate={climate} disaster={disaster} width={width} depth={depth}/>
  {!snapshot&&<OrbitControls ref={r=>{control.current=r}} makeDefault target={[0,.25,0]} minDistance={detail?3:6} maxDistance={radius*2} minPolarAngle={.25} maxPolarAngle={Math.PI/2.05} enableDamping/>}
 </>
}
