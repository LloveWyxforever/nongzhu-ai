const backendOrigin = ((import.meta as any).env.VITE_API_ORIGIN || "").replace(/\/$/, "");
export const apiUrl = (path:string) => backendOrigin + path;
export type Plot={id:number;name:string;crop:string;region:string;area:number;planted:string;stage:string;status:string;notes:string;simulated:number|boolean};
export type Task={id:number;plot_id:number;plot_name:string;title:string;due:string;done:number;kind:string};
export async function api<T=any>(path:string,init?:RequestInit):Promise<T>{
 const res=await fetch(apiUrl('/api'+path),{...init,headers: init?.body instanceof FormData ? init.headers : {'Content-Type':'application/json',...init?.headers}});
 if(!res.ok){let d;try{d=await res.json()}catch{throw Error(`服务请求失败 (${res.status})`)}throw Error(typeof d.detail==='string'?d.detail:'请检查表单内容');}return res.json();
}
export const names:Record<string,string>={planting:'种植管理',risk:'病虫害与风险',industry:'产业助农'};
