const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function route(owner = 'author', fail = false) {
 const record = { id: '00000000-0000-4000-8000-000000000001', user_id: owner };
 const filters = [];
 let patch;
 const db = { from() { const q = { update(value) { patch=value; return q; }, eq(k,v) { filters.push([k,v]); return q; }, select() { return q; }, async maybeSingle() {
  if(fail) return { error: {} };
  if(!filters.every(([k,v])=>record[k]===v)) return { data:null };
  Object.assign(record,patch);return { data:{id:record.id} };
 }};return q; }};
 let calls=0;
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('app/api/story-feeling/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports:mod.exports,module:mod,process,require:n=>n==='next/server'?{NextResponse:{json:(body,options)=>({body,status:options?.status??200})}}:{createClient:()=>++calls===1?{auth:{getUser:async()=>({data:{user:{id:'author'}}})}}:db}});
 return {post:mod.exports.POST,record};
}
function request(feeling, authenticated=true) { return { json:async()=>({storyId:'00000000-0000-4000-8000-000000000001',feeling}),headers:{get:()=>authenticated?'Bearer token':null} }; }
test('only the authenticated story owner can save a feeling',async()=>{
 const own=route();assert.equal((await own.post(request('Confused'))).status,200);assert.equal(own.record.feeling,'Confused');
 const other=route('someone-else');assert.equal((await other.post(request('Confused'))).status,404);assert.equal(other.record.feeling,undefined);
});
test('invalid feelings and unauthenticated requests cannot save',async()=>{
 assert.equal((await route().post(request('invented'))).status,400);
 assert.equal((await route().post(request('Confused',false))).status,401);
});
test('database setup or write failures report failure rather than claim success',async()=>{
 assert.equal((await route('author',true).post(request('Confused'))).status,503);
});
