// Runs the actual bundled Worker against an independent SQLite adapter.
// The adapter covers D1 prepare/bind/first/run; no production database is touched.
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import worker from '../build/worker.js';
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync(new URL('../migrations/0001.sql',import.meta.url),'utf8'));
const DB={prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)??null},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}}}}}}}};
const env={DB,ASSETS:{fetch:async()=>new Response('static asset')},DEEPSEEK_MODEL:process.env.DEEPSEEK_MODEL||'deepseek-flash',DEEPSEEK_BASE_URL:process.env.DEEPSEEK_BASE_URL||'https://api.deepseek.com'};
let cookie='';const tasks=[];const ctx={waitUntil(p){tasks.push(p)}};
async function request(path,body,method='GET',visitor=cookie,headers={}){const res=await worker.fetch(new Request('https://example.test'+path,{method,headers:{Cookie:visitor,Origin:'https://example.test','Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,ctx);if(res.headers.has('set-cookie')&&visitor===cookie)cookie=res.headers.get('set-cookie').split(';')[0];return res}
const j=async(...args)=>{const r=await request(...args);const value=await r.json();assert.equal(r.status,200,JSON.stringify(value));return value};
await j('/api/health');assert.equal((await j('/api/plots')).length,6);
await j('/api/garden/1',{action:'plant',crop:'番茄'},'POST');await j('/api/garden/simulation',{weather:'rain',season:'autumn',area_multiplier:2,kind:'insects',plot_id:-1,severity:80},'PATCH');
const g=await j('/api/garden');assert.equal(g.slots[0].crop,'番茄');assert.equal(g.simulation.weather,'rain');assert.equal(g.simulation.pests[0].plotId,-1);
const other=await request('/api/garden',undefined,'GET','nz_session=00000000-0000-0000-0000-000000000001');assert.equal((await other.json()).slots[0].crop,null);
assert.equal((await request('/api/garden/1',{action:'plant',crop:'玉米'},'POST')).status,409);
assert.equal((await request('/api/garden/simulation',{weather:'invalid'},'PATCH')).status,422);
assert.equal((await request('/api/tasks',{plot_id:1,title:'巡田记录',due:'2026-11-20'},'POST')).status,200);
assert.equal((await j('/api/tasks'))[0].plot_name,'向阳一号田');
assert.ok((await j('/api/knowledge/search?q='+encodeURIComponent('李保国'))).length>0);
const form=new FormData();form.set('file',new File(['云端专用测试：番茄育苗需要记录温度。'],'测试.md'));form.set('category','蔬菜种植');
const imported=await worker.fetch(new Request('https://example.test/api/knowledge',{method:'POST',headers:{Cookie:cookie,Origin:'https://example.test'},body:form}),env,ctx);assert.equal(imported.status,200);const doc=await imported.json();assert.ok((await j('/api/knowledge/search?q='+encodeURIComponent('云端专用测试'))).some(r=>r.name==='测试.md'));await j('/api/knowledge/'+doc.id,undefined,'DELETE');assert.equal((await j('/api/knowledge/search?q='+encodeURIComponent('云端专用测试'))).length,0);
assert.equal((await request('/api/chat',{message:'如何记录番茄育苗？'},'POST')).status,503);
assert.equal((await request('/api/tasks',{done:true},'POST',cookie,{Origin:'https://other.test'})).status,403);
console.log('PASS: persistence, isolation, planting, simulation, tasks, knowledge import/search/delete, validation, CSRF, unconfigured AI');
if(process.env.LIVE_AI_TEST==='1'){
 env.DEEPSEEK_API_KEY=process.env.DEEPSEEK_API_KEY;env.AI_ACCESS_CODE='one-test-code';
 assert.equal((await request('/api/chat',{message:'如何记录番茄育苗？'},'POST')).status,403);
 const response=await request('/api/chat',{message:'番茄育苗时应该记录哪些信息？请简明回答。',agent:'planting'},'POST',cookie,{'X-AI-Access-Code':'one-test-code'});assert.equal(response.status,200);const text=await response.text();await Promise.all(tasks);const events=text.split('\n\n').filter(Boolean).map(line=>JSON.parse(line.slice(6)));assert.ok(!events.some(e=>e.type==='error'),JSON.stringify(events.filter(e=>e.type==='error')));assert.ok(events.some(e=>e.type==='done'));assert.ok(events.some(e=>e.type==='agent'&&e.status==='completed'));const answer=events.filter(e=>e.type==='delta').map(e=>e.text).join('');assert.ok(answer.length>20);fs.writeFileSync(new URL('../真实AI联调结果.json',import.meta.url),JSON.stringify({tested_at:new Date().toISOString(),mode:'actual-worker-bundle-local-sqlite-adapter',model:env.DEEPSEEK_MODEL,requests:2,events,answer},null,2));console.log('PASS: actual specialist + synthesis model calls, SSE, answer persistence; answer characters:',answer.length);
}
