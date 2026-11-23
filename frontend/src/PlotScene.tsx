import {useEffect,useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import {OrbitControls,OrthographicCamera} from '@react-three/drei';
import * as THREE from 'three';
import type {Plot} from './api';

type Part={geometry:THREE.BufferGeometry;color:string;matrices:THREE.Matrix4[]};
function Instances({part}:{part:Part}){
 useEffect(()=>()=>part.geometry.dispose(),[part.geometry]);
 return <instancedMesh args={[part.geometry,undefined,part.matrices.length]} ref={mesh=>{if(mesh){part.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere()}}} castShadow receiveShadow><meshStandardMaterial color={part.color} roughness={.85}/></instancedMesh>
}
function DetailedPlants({plot}:{plot:Plot}){
 const parts=useMemo(()=>{
  const stage=['幼苗期','生长期','开花期','抽穗期','灌浆期','成熟期'].indexOf(plot.stage);
  const growth=stage<0?.65:[.32,.58,.76,.88,.96,1][stage];
  const grain=stage>=3,fruit=stage>=2;
  const rice=/水稻|小麦|稻|麦/.test(plot.crop),corn=/玉米/.test(plot.crop),bean=/豆/.test(plot.crop),tomato=/番茄|西红柿/.test(plot.crop);
  const green=plot.status==='待收获'?'#aaa34d':plot.status==='需关注'?'#9d9a50':'#578347';
  const stem:Part={geometry:new THREE.CylinderGeometry(.022,.035,1,5),color:green,matrices:[]};
  const leaves:Part={geometry:new THREE.SphereGeometry(1,6,4),color:green,matrices:[]};
  const heads:Part={geometry:rice?new THREE.ConeGeometry(.10,.38,6):new THREE.SphereGeometry(1,7,5),color:tomato?'#cf6546':bean?'#90a748':'#d8b75b',matrices:[]};
  const add=(part:Part,x:number,y:number,z:number,sx:number,sy:number,sz:number,rx=0,ry=0,rz=0)=>{const matrix=new THREE.Matrix4();matrix.compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(sx,sy,sz));part.matrices.push(matrix)};
  for(let row=0;row<7;row++)for(let col=0;col<10;col++){
   const x=-5.4+col*1.2,z=-3.6+row*1.2;
   const h=(corn?2.5:rice?1.55:bean||tomato?1.3:.55)*growth*(.94+((row*7+col)%5)*.03);
   const count=rice?3:1;
   for(let shoot=0;shoot<count;shoot++){
    const px=x+(shoot-1)*.12,pz=z+(shoot%2)*.12;
    add(stem,px,.25+h/2,pz,1,h,1);
    if(rice||corn||bean||tomato){
     for(let leaf=0;leaf<(corn?5:4);leaf++){
      const angle=leaf*2.4+row*.2,level=.25+h*(.25+leaf*.14),length=(corn?.70:rice?.42:.29)*growth;
      add(leaves,px+Math.cos(angle)*length*.5,level,pz+Math.sin(angle)*length*.5,length,.025,rice?.045:corn?.13:.17,0,-angle,.25*(leaf%2?1:-1));
     }
    }else{
     for(let leaf=0;leaf<7;leaf++){const angle=leaf*Math.PI*2/7;add(leaves,x+Math.cos(angle)*.17,.25+h*.65,z+Math.sin(angle)*.17,.35*growth,.12*growth,.21*growth,0,-angle,.2)}
    }
    if(rice&&grain)add(heads,px+.06,.25+h+.12,pz,1,growth,1,0,0,-.22);
    if(corn&&grain)add(heads,px+.12,.25+h*.65,pz,.13,.32,.13,0,0,-.2);
    if((tomato||bean)&&fruit)for(let f=0;f<3;f++)add(heads,px+(f%2?.19:-.19),.25+h*(.4+f*.16),pz+.10,tomato?.12:.055,tomato?.12:.20,tomato?.12:.055,0,0,.25);
   }
  }
  return [stem,leaves,heads].filter(p=>p.matrices.length);
 },[plot.crop,plot.stage,plot.status]);
 return <>{parts.map((part,i)=><Instances key={i} part={part}/>)}</>;
}
function Ground({position,size,color}:{position:[number,number,number];size:[number,number,number];color:string}){return <mesh position={position} receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color}/></mesh>}
export default function PlotScene({plot,control}:{plot:Plot;control:{current:any}}){
 const width=useThree(s=>s.size.width),height=useThree(s=>s.size.height);
 const zoom=Math.min(width/20,height/15,48);
 return <>
  <color attach="background" args={['#e7eddf']}/>
  <OrthographicCamera makeDefault position={[15,12,17]} zoom={zoom} near={.1} far={150}/>
  <ambientLight intensity={1.5}/><directionalLight position={[-8,17,6]} intensity={2} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-bias={-.001}/>
  <Ground position={[0,-.35,0]} size={[17,.65,13]} color="#b4c393"/>
  <Ground position={[0,.005,0]} size={[14,.12,10]} color="#8a7051"/>
  {/稻/.test(plot.crop)&&<mesh position={[0,.075,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[13.7,9.7]}/><meshStandardMaterial color="#91afa0" transparent opacity={.65} roughness={.3}/></mesh>}
  {Array.from({length:7},(_,row)=><Ground key={row} position={[0,.15,-3.6+row*1.2]} size={[13,.21,.65]} color="#ab8c60"/>)}
  {[-5.15,5.15].map(z=><Ground key={z} position={[0,.1,z]} size={[14.5,.25,.4]} color="#c6c69a"/>)}
  {[-7.15,7.15].map(x=><Ground key={x} position={[x,.1,0]} size={[.4,.25,10.7]} color="#c6c69a"/>)}
  <Ground position={[0,.06,5.85]} size={[14.6,.12,.55]} color="#ddd1ae"/>
  <Ground position={[-7.8,.04,0]} size={[.38,.1,10.8]} color="#85aaa3"/>
  <DetailedPlants plot={plot}/>
  <OrbitControls ref={r=>{control.current=r}} makeDefault target={[0,.6,0]} minZoom={Math.min(12,zoom*.6)} maxZoom={110} minPolarAngle={.18} maxPolarAngle={Math.PI/2.1} enableDamping/>
 </>
}
