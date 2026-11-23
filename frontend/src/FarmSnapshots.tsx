import {Component,Suspense,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Canvas,useFrame} from '@react-three/fiber';
import ReferenceScene from './ReferenceScene';
import {slotPlot,type Slot} from './Garden';
import type {Weather,Pest,Climate,Disaster,Season} from './FarmSimulation';

type Shot={id:number;key:string;plot:ReturnType<typeof slotPlot>;weather:Weather;pests:Pest[];climate:Climate;disaster:Disaster;season:Season;hour:number;areaMultiplier:number};
export type Preview={url:string;key:string;updated:number};
export function snapshotKey(slot:Slot,weather:Weather,pests:Pest[],climate:Climate='temperate',disaster:Disaster='none',season:Season='spring',hour=12,areaMultiplier=1){
 return JSON.stringify([slot.id,slot.crop,Math.round(slot.progress),Math.round(slot.water),slot.harvests,weather,climate,disaster,season,areaMultiplier,Math.floor(hour*4),pests.filter(p=>p.plotId===-slot.id)]);
}
class CaptureBoundary extends Component<{children:ReactNode;onError:()=>void},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(){this.props.onError()}
 render(){return this.state.failed?null:this.props.children}
}
function Capture({shot,onReady,onError}:{shot:Shot;onReady:(shot:Shot,url:string)=>void;onError:()=>void}){
 const frames=useRef(0),finished=useRef(false);
 useFrame(({gl,scene,camera})=>{
  if(finished.current||++frames.current<4)return;
  try{
  camera.lookAt(0,.25,0);camera.updateMatrixWorld();
  gl.render(scene,camera);
  const url=gl.domElement.toDataURL('image/png');
  finished.current=true;onReady(shot,url);
  }catch{finished.current=true;onError()}
 },1);
 return null;
}

/** One offscreen WebGL renderer serves every card; cards display static PNGs. */
export default function FarmSnapshots({slots,weather,pests,climate='temperate',disaster='none',season='spring',hour=12,areaMultiplier=1,onPreview,onError}:{slots:Slot[];weather:Weather;pests:Pest[];climate?:Climate;disaster?:Disaster;season?:Season;hour?:number;areaMultiplier?:number;onPreview:(id:number,preview:Preview)=>void;onError:()=>void}){
 const shots=slots.map(s=>({id:s.id,key:snapshotKey(s,weather,pests,climate,disaster,season,hour,areaMultiplier),plot:slotPlot(s),weather,climate,disaster,season,areaMultiplier,hour:Math.floor(hour*4)/4,pests:pests.filter(p=>p.plotId===-s.id)}));
 const latest=useRef(shots);latest.current=shots;
 const cache=useRef(new Map<number,string>());
 const [active,setActive]=useState<Shot>();
 const [failed,setFailed]=useState(false);
 const control=useMemo(()=>({current:null}),[]);
 const callbacks=useRef({onPreview,onError});callbacks.current={onPreview,onError};
 const revision=JSON.stringify(shots.map(s=>s.key));
 useEffect(()=>{
  if(failed||active)return;
  const next=latest.current.find(s=>cache.current.get(s.id)!==s.key);
  if(next)setActive(next);
 },[revision,active,failed]);
 useEffect(()=>{if(!active||failed)return;const timeout=setTimeout(()=>{setFailed(true);callbacks.current.onError()},12000);return()=>clearTimeout(timeout)},[active,failed]);
 function fail(){setFailed(true);callbacks.current.onError()}
 function done(shot:Shot,url:string){
  cache.current.set(shot.id,shot.key);
  if(latest.current.find(s=>s.id===shot.id)?.key===shot.key)callbacks.current.onPreview(shot.id,{url,key:shot.key,updated:Date.now()});
  setActive(undefined);
 }
 if(failed)return null;
 return <div className="snapshot-renderer" aria-hidden="true"><CaptureBoundary onError={fail}><Canvas shadows dpr={1} gl={{antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'}} frameloop={active?'always':'never'} onCreated={({gl})=>gl.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fail()},{once:true})} fallback={<CaptureFailure onError={fail}/>}>
  {active&&<Suspense fallback={null}><ReferenceScene key={active.key} plots={[active.plot]} detail={active.plot} control={control} onSelect={()=>{}} weather={active.weather} pests={active.pests} climate={active.climate} disaster={active.disaster} season={active.season} hour={active.hour} areaMultiplier={active.areaMultiplier} snapshot/><Capture key={'capture'+active.key} shot={active} onReady={done} onError={fail}/></Suspense>}
 </Canvas></CaptureBoundary></div>;
}
function CaptureFailure({onError}:{onError:()=>void}){useEffect(onError,[]);return null}
