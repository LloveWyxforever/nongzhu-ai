import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';

export type Season='spring'|'summer'|'autumn'|'winter';
export const seasonNames:Record<Season,string>={spring:'春季',summer:'夏季',autumn:'秋季',winter:'冬季'};
export const seasonPalette={
 spring:{ground:'#a5cf75',leaf:'#86be58',crop:'#98d67a',sky:'#acd8ec',light:'#fff3d7'},
 summer:{ground:'#509442',leaf:'#28733d',crop:'#408c42',sky:'#62b9e7',light:'#fff0b0'},
 autumn:{ground:'#b99a4c',leaf:'#d87c2e',crop:'#d5a250',sky:'#dfc29c',light:'#ffd0a0'},
 winter:{ground:'#eef5fc',leaf:'#dbe8ef',crop:'#c4d9e3',sky:'#aebfd8',light:'#c9e1ff'}
};
export type Climate='temperate'|'hot'|'humid'|'cold';
export type Disaster='none'|'drought'|'flood'|'hail'|'wind';
export const climateNames:Record<Climate,string>={temperate:'温和气候',hot:'炎热干燥',humid:'温暖湿润',cold:'寒冷气候'};
export const disasterNames:Record<Disaster,string>={none:'无灾害',drought:'干旱',flood:'洪涝',hail:'冰雹',wind:'大风'};
export type Environment={area_multiplier:1|2|3|4;hour:number;day_running:boolean;day_seconds:120|240|600;season:Season;climate:Climate;disaster:Disaster;automatic:boolean;next_change:number};
export type Weather='sunny'|'cloudy'|'rain'|'snow';
export type Pest={plotId:number;kind:'insects'|'disease';severity:number};
export const weatherNames:Record<Weather,string>={sunny:'晴天',cloudy:'阴天',rain:'降雨',snow:'降雪'};

export function WeatherParticles({weather,width,depth}:{weather:Weather;width:number;depth:number}){
 const rain=weather==='rain',footWidth=width+.14,footDepth=depth+.14;
 const count=Math.min(window.innerWidth<768?800:1600,Math.ceil(footWidth*footDepth*(window.innerWidth<768?4:7)));
 const wrap=(value:number,span:number)=>((value+span/2)%span+span)%span-span/2;
 const points=useRef<THREE.Points>(null),lines=useRef<THREE.LineSegments>(null);
 const positions=useMemo(()=>{const v=new Float32Array(count*(rain?6:3));const columns=Math.ceil(Math.sqrt(count*footWidth/footDepth)),rows=Math.ceil(count/columns);for(let i=0;i<count;i++){const stride=rain?6:3,x=((i%columns+.5)/columns-.5)*footWidth,y=.85+(i*.61803398875%1)*8.45,z=((Math.floor(i/columns)+.5)/rows-.5)*footDepth;v.set(rain?[x,y,z,x,Math.max(.15,y-.65),z]:[x,y,z],i*stride)}return v},[footWidth,footDepth,count,rain]);
 const texture=useMemo(()=>{const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d')!;const g=ctx.createRadialGradient(16,16,1,16,16,15);g.addColorStop(0,'#ffffffff');g.addColorStop(.45,'#fffffff0');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(0,0,32,32);return new THREE.CanvasTexture(c)},[]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 useFrame(({clock},delta)=>{const obj=rain?lines.current:points.current;if(!obj)return;const a=obj.geometry.attributes.position,dt=Math.min(delta,.05);for(let i=0;i<count;i++){const index=rain?i*2:i;let y=a.getY(index)-dt*(rain?9:1.5);if(y<.25)y=9.3;const x=wrap(a.getX(index)+(rain?0:Math.sin(clock.elapsedTime+i)*dt*.35),footWidth),z=wrap(a.getZ(index)+(rain?0:Math.cos(clock.elapsedTime*.7+i)*dt*.2),footDepth);a.setXYZ(index,x,y,z);if(rain)a.setXYZ(index+1,x,Math.max(.15,y-.65),z)}a.needsUpdate=true});
 return rain?<lineSegments ref={lines} frustumCulled={false} renderOrder={4}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry><lineBasicMaterial color="#bddfff" transparent opacity={.85} depthWrite={false}/></lineSegments>:<points ref={points} frustumCulled={false} renderOrder={4}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry><pointsMaterial map={texture} color="#ffffff" size={.20} transparent opacity={.95} depthWrite={false}/></points>;
}

/** Exaggerated illustrative insects with visible anatomy and two movement patterns. */
function AnimatedInsect({index,size}:{index:number;size:number}){
 const body=useRef<THREE.Group>(null),wings=useRef<THREE.Group>(null),legs=useRef<THREE.Group>(null);
 const flying=index%2===0,phase=index*2.39996;
 useFrame(({clock})=>{const t=clock.elapsedTime,speed=flying?.65:.27,r=size*(flying?.38:.34),a=t*speed+phase;
  if(body.current){body.current.position.set(Math.sin(a)*r,flying?1.5+Math.sin(t*1.8+phase)*.45:.46+Math.sin(t*8+phase)*.012,Math.sin(a*.83+phase)*r);body.current.rotation.y=Math.atan2(Math.cos(a),.83*Math.cos(a*.83+phase))}
  wings.current?.children.forEach((wing,i)=>{wing.rotation.z=(i===0?1:-1)*(.35+Math.sin(t*32+phase)*.65)});
  legs.current?.children.forEach((leg,i)=>{leg.rotation.y=Math.sin(t*12+phase+(i%2)*Math.PI)*.35});
 });
 return <group ref={body} scale={flying?1:1.15}>
  <mesh scale={[.75,.68,1.35]}><sphereGeometry args={[.13,10,8]}/><meshStandardMaterial color={flying?'#b87919':'#a3b52e'} roughness={.65}/></mesh>
  <mesh position={[0,.01,.20]}><sphereGeometry args={[.085,8,6]}/><meshStandardMaterial color="#292017"/></mesh>
  {[-1,1].map(side=><group key={side}><mesh position={[side*.05,.06,.26]}><sphereGeometry args={[.025,6,4]}/><meshBasicMaterial color="#faf5cc"/></mesh><mesh position={[side*.065,.11,.29]} rotation={[side*.45,0,side*.45]}><boxGeometry args={[.012,.15,.012]}/><meshBasicMaterial color="#352516"/></mesh></group>)}
  <group ref={legs}>{[-1,1].flatMap(side=>[-1,0,1].map(row=><group key={`${side}-${row}`} position={[side*.07,-.035,row*.10]}><mesh position={[side*.10,-.04,0]} rotation={[0,row*.35,side*.48]}><boxGeometry args={[.24,.018,.02]}/><meshBasicMaterial color="#3a2916"/></mesh></group>))}</group>
  {flying&&<group ref={wings}>{[-1,1].map(side=><group key={side}><mesh position={[side*.20,.065,0]} scale={[1,.13,.6]}><sphereGeometry args={[.23,10,6]}/><meshStandardMaterial color="#f7e4ad" transparent opacity={.85} side={THREE.DoubleSide}/></mesh></group>)}</group>}
  {!flying&&[-.09,0,.09].map(z=><mesh key={z} position={[0,.085,z]}><boxGeometry args={[.18,.025,.024]}/><meshBasicMaterial color="#48551b"/></mesh>)}
 </group>;
}

export function PestEffect({pest,x,z,detail,snapshot=false,layoutScale=1}:{layoutScale?:number;pest:Pest;x:number;z:number;detail:boolean;snapshot?:boolean}){
 const halo=useRef<THREE.Mesh>(null);
 useFrame(({clock})=>{if(halo.current){const scale=1+Math.sin(clock.elapsedTime*2.5)*.045;halo.current.scale.set(scale,scale,1)}});
 const size=(detail?3.7:1.9)*layoutScale;
 return <group position={[x,0,z]}>
  <mesh ref={halo} rotation={[-Math.PI/2,0,0]} position={[0,.33,0]}><ringGeometry args={[size*.47,size*.56,40]}/><meshBasicMaterial color="#ee602c" transparent opacity={.8} depthWrite={false}/></mesh>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,.32,0]}><planeGeometry args={[size,size]}/><meshBasicMaterial color={pest.kind==='insects'?'#dd8b27':'#bf512c'} transparent opacity={.12+pest.severity*.002} depthWrite={false}/></mesh>
  {pest.kind==='disease'&&Array.from({length:7},(_,i)=><group key={'leaf'+i} position={[Math.sin(i*3.8)*size*.34,.8+(i%3)*.21,Math.cos(i*3.8)*size*.34]} rotation={[.3,i,.5]}><mesh scale={[1,.4,.55]}><sphereGeometry args={[detail?.38:.28,8,6]}/><meshStandardMaterial color="#c5a330"/></mesh><mesh position={[0,.10,0]} scale={[1,.3,.8]}><sphereGeometry args={[.14,7,5]}/><meshBasicMaterial color="#713422"/></mesh></group>)}
  {pest.kind==='insects'?<group>{Array.from({length:Math.round(8+pest.severity*.12)},(_,i)=><AnimatedInsect key={i} index={i} size={size}/>)}</group>:<group>{Array.from({length:Math.round(12+pest.severity*.30)},(_,i)=><mesh key={i} position={[Math.sin(i*4.1)*size*.4,.45+(i%4)*.15,Math.cos(i*2.4)*size*.4]}><sphereGeometry args={[.15+(i%3)*.035,8,6]}/><meshStandardMaterial color={i%2?'#e4b638':'#8b3c21'}/></mesh>)}</group>}
  {!snapshot&&<Html position={[0,detail?2.3:1.7,0]} center zIndexRange={[2,0]} style={{pointerEvents:'none'}}><span className="sim-pest-label">模拟{pest.kind==='insects'?'虫害（爬行 + 飞动）':'病斑'} · {pest.severity}%</span></Html>}
 </group>;
}

/** Illustrative climate and disaster layers, shared by live scene and snapshots. */
export function EnvironmentEffect({climate,disaster,width,depth}:{climate:Climate;disaster:Disaster;width:number;depth:number}){
 const motion=useRef<THREE.Group>(null);
 useFrame(({clock})=>{const t=clock.elapsedTime;motion.current?.children.forEach((o,i)=>{
  if(disaster==='hail')o.position.y=.35+((i*.41-t*5)%5+5)%5;
  else if(disaster==='wind'){o.position.x=((i*.73+t*4)%width)-width/2;o.position.y=.7+(i%6)*.4;o.rotation.z=Math.sin(t+i)*.2}
  else if(climate==='hot')o.position.y=.4+((i*.17+t*.3)%2.8);
 })});
 const tint=climate==='hot'?'#d99537':climate==='cold'?'#bbddff':climate==='humid'?'#428a67':'#ffffff';
 return <group>
 {climate!=='temperate'&&<mesh position={[0,.16,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[width,depth]}/><meshBasicMaterial color={tint} transparent opacity={.22} depthWrite={false}/></mesh>}
 {disaster==='flood'&&<mesh position={[0,.48,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[width,depth]}/><meshStandardMaterial color="#379bc2" transparent opacity={.65} roughness={.15} metalness={.4}/></mesh>}
 {disaster==='drought'&&<group>{Array.from({length:36},(_,i)=><mesh key={i} position={[Math.sin(i*8.1)*width*.44,.31,Math.cos(i*4.3)*depth*.44]} rotation={[-Math.PI/2,0,i*1.7]}><planeGeometry args={[.025,.3+(i%4)*.15]}/><meshBasicMaterial color="#754324"/></mesh>)}</group>}
 <group ref={motion}>{Array.from({length:disaster==='hail'?150:disaster==='wind'?65:climate==='hot'?30:0},(_,i)=><mesh key={`${disaster}-${climate}-${i}`} position={[Math.sin(i*7.1)*width*.48,.4+(i%12)*.4,Math.cos(i*3.7)*depth*.48]}>
 {disaster==='hail'?<icosahedronGeometry args={[.085,0]}/>:disaster==='wind'?<boxGeometry args={[.65,.018,.025]}/>:<sphereGeometry args={[.035,5,4]}/>}
 <meshBasicMaterial color={disaster==='hail'?'#e4f7ff':disaster==='wind'?'#e9d4a8':'#ffc258'} transparent opacity={.85}/></mesh>)}</group>
 </group>;
}

export function SeasonalScenery({season,width,depth}:{season:Season;width:number;depth:number}){
 const palette=seasonPalette[season];
 const leaves=useRef<THREE.Group>(null);
 useFrame(({clock})=>leaves.current?.children.forEach((o,i)=>{o.position.y=.2+((i*.31-clock.elapsedTime*.24)%2.4+2.4)%2.4;o.rotation.z=clock.elapsedTime*.5+i}));
 return <group>
 {Array.from({length:8},(_,i)=>{const x=(i<4?-1:1)*(width/2-.48),z=(-.38+(i%4)*.25)*depth;return <group key={i} position={[x,.14,z]}>
 <mesh position={[0,.65,0]} castShadow><cylinderGeometry args={[.07,.12,1.3,6]}/><meshStandardMaterial color="#70503b"/></mesh>
 <mesh position={[0,1.5,0]} castShadow scale={season==='winter'?[.8,1,.8]:[1,1,1]}><icosahedronGeometry args={[.59,1]}/><meshStandardMaterial color={palette.leaf}/></mesh>
 {season==='spring'&&Array.from({length:5},(_,j)=><mesh key={j} position={[Math.sin(j*2)*.42,1.5+Math.cos(j*2)*.35,.3]}><icosahedronGeometry args={[.11,0]}/><meshStandardMaterial color="#ffd2e5"/></mesh>)}
 </group>})}
 {season==='winter'&&<mesh position={[0,.14,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[width,depth]}/><meshStandardMaterial color="#f1f7ff" roughness={1}/></mesh>}
 {(season==='autumn'||season==='spring')&&<group ref={leaves}>{Array.from({length:45},(_,i)=><mesh key={i} position={[Math.sin(i*7.3)*width*.46,.2+i%3,Math.cos(i*3.1)*depth*.46]} rotation={[1,i,0]}><circleGeometry args={[season==='autumn'?.07:.045,5]}/><meshStandardMaterial color={season==='autumn'?'#dc8a32':'#ffd5e9'} side={THREE.DoubleSide}/></mesh>)}</group>}
 </group>;
}
