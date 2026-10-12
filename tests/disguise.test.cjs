const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
function storage() { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) }; }
function load(file, deps, globals) {
  const m = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports: m.exports, module: m, require: n => deps[n], crypto: webcrypto, TextEncoder, Uint8Array, ...globals });
  return m.exports;
}
function nodes(x) { if (!x || typeof x !== 'object') return []; if (Array.isArray(x)) return x.flatMap(nodes); return [x, ...nodes(x.props?.children)]; }
function harness(localStorage, context, client, recoveryClient) {
  const states=[], refs=[], effects=[], listeners={}; let index=0, refIndex=0, mounted=false;
  const jsx=(type,props)=>({type,props});
  const lib=load('lib/disguise.ts',{}, {localStorage});
  const mod=load('components/DisguiseMode.tsx',{
    react:{createContext:()=>({Provider:'provider'}),useContext:()=>context,useState:init=>{const i=index++; if (!(i in states)) states[i]=init; return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];},useRef:init=>{const i=refIndex++;return refs[i]??(refs[i]={current:init});},useEffect:fn=>{if(!mounted)effects.push(fn);}},
    'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{usePathname:()=>'/diary'},'@/lib/disguise':lib,'@/lib/supabase':{supabase:client},'@supabase/supabase-js':{createClient:()=>recoveryClient},
  },{process:{env:{NEXT_PUBLIC_SUPABASE_URL:"https://example.test",NEXT_PUBLIC_SUPABASE_ANON_KEY:"test"}},localStorage,window:{addEventListener:(n,f)=>listeners[n]=f,removeEventListener:()=>{}},document:{visibilityState:'visible',addEventListener:(n,f)=>listeners[n]=f,removeEventListener:()=>{},querySelector:()=>null,createElement:()=>({dataset:{}}),head:{appendChild:()=>{}}}});
  return {lib,states,listeners, render(settings=false){index=0;refIndex=0; const tree=settings?mod.DisguiseSettings():mod.DisguiseProvider({children:'SECRET CONTENT'});mounted=true;return nodes(tree);}, async mount(){for(const fn of effects)fn();await new Promise(setImmediate);} };
}
const event={preventDefault(){}};
const findButton=(tree,label)=>tree.find(n=>n.type==='button'&&n.props.children===label);
const concealed=tree=>!JSON.stringify(tree).includes('SECRET CONTENT') || tree.some(n=>n.type==='div'&&n.props.hidden===true);
const pinInput=tree=>tree.find(n=>n.type==='input'&&n.props.pattern==='[0-9]{4}');

test('PIN hashing uses salt, never stores the raw PIN, and validates settings',async()=>{
 const s=storage();const lib=load('lib/disguise.ts',{}, {localStorage:s});const hash=await lib.hashPin('1234','salt-a');assert.equal(hash.length,64);assert.equal(hash,await lib.hashPin('1234','salt-a'));assert.notEqual(hash,await lib.hashPin('1234','salt-b'));assert.notEqual(hash,await lib.hashPin('0000','salt-a'));assert.equal(lib.readDisguise(),null);s.setItem(lib.DISGUISE_KEY,'{}');assert.throws(()=>lib.readDisguise());
});

test('locked routes conceal content; correct PIN opens it; leaving locks it; attempts are throttled',async()=>{
 const s=storage();const h=harness(s);s.setItem(h.lib.DISGUISE_KEY,JSON.stringify({salt:'salt',hash:await h.lib.hashPin('1234','salt'),ownerId:'owner',failures:0,retryAt:0}));
 assert(concealed(h.render()));await h.mount();assert(concealed(h.render()));
 async function attempt(pin){let tree=h.render();if(!pinInput(tree))findButton(tree,'Workspace access').props.onClick();tree=h.render();pinInput(tree).props.onChange({target:{value:pin}});tree=h.render();await tree.find(n=>n.type==='form'&&pinInput(nodes(n))).props.onSubmit(event);}
 await attempt('9999');assert(JSON.stringify(h.render()).includes('Incorrect PIN.'));await attempt('1234');assert(JSON.stringify(h.render()).includes('SECRET CONTENT'));h.listeners.blur();assert(concealed(h.render()));
 for(let i=0;i<5;i++)await attempt('0000');await attempt('1234');assert(JSON.stringify(h.render()).includes('Too many attempts'));assert(concealed(h.render()));
});

test('planner tasks persist and can be completed and removed',async()=>{
 const s=storage();const h=harness(s);s.setItem(h.lib.DISGUISE_KEY,JSON.stringify({salt:'salt',hash:'hash',ownerId:'owner',failures:0,retryAt:0}));h.render();await h.mount();let tree=h.render();tree.find(n=>n.type==='input'&&n.props.placeholder).props.onChange({target:{value:'Biology homework'}});tree=h.render();await tree.find(n=>n.type==='form').props.onSubmit(event);assert.equal(JSON.parse(s.getItem('planner.tasks.v1'))[0].title,'Biology homework');tree=h.render();tree.find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange();assert.equal(JSON.parse(s.getItem('planner.tasks.v1'))[0].done,true);findButton(h.render(),'Remove').props.onClick();assert.equal(JSON.parse(s.getItem('planner.tasks.v1')).length,0);
});

test('setup requires matching four-digit PINs and binds the setting to the authenticated account',async()=>{
 const s=storage();let settings;const h=harness(s,{enabled:false,enable:v=>settings=v},{auth:{getUser:async()=>({data:{user:{id:'owner'}}})}});findButton(h.render(true),'Off · Enable').props.onClick();let tree=h.render(true);const inputs=tree.filter(n=>n.type==='input');inputs[0].props.onChange({target:{value:'1234'}});inputs[1].props.onChange({target:{value:'0000'}});await h.render(true).find(n=>n.type==='form').props.onSubmit(event);assert.equal(settings,undefined);tree=h.render(true);tree.filter(n=>n.type==='input')[1].props.onChange({target:{value:'1234'}});await h.render(true).find(n=>n.type==='form').props.onSubmit(event);assert.equal(settings.ownerId,'owner');assert.equal(settings.hash,await h.lib.hashPin('1234',settings.salt));assert(!JSON.stringify(settings).includes('1234'));
});

test('PIN recovery rejects other accounts and accepts only the enabling account',async()=>{
 for(const userId of ['other','owner']){
 const s=storage();const recovery={auth:{signInWithPassword:async()=>({data:{user:{id:userId}}}),signOut:async()=>({})}};const h=harness(s,undefined,{},recovery);s.setItem(h.lib.DISGUISE_KEY,JSON.stringify({salt:'salt',hash:'hash',ownerId:'owner',failures:0,retryAt:0}));h.render();await h.mount();findButton(h.render(),'Workspace access').props.onClick();findButton(h.render(),'Forgot PIN?').props.onClick();let tree=h.render();tree.find(n=>n.type==='input'&&n.props.type==='email').props.onChange({target:{value:'person@example.test'}});tree.find(n=>n.type==='input'&&n.props.type==='password').props.onChange({target:{value:'password'}});tree=h.render();await tree.find(n=>n.type==='form'&&nodes(n).some(x=>x.type==='input'&&x.props.type==='email')).props.onSubmit(event);assert.equal(s.getItem(h.lib.DISGUISE_KEY)===null,userId==='owner');
 }
});
