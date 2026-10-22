const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(file,deps){const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:mod,exports:mod.exports,setTimeout,require:n=>deps[n]});return mod.exports;}
function nodes(x){if(!x||typeof x!=='object')return[];if(Array.isArray(x))return x.flatMap(nodes);return[x,...nodes(x.props?.children)];}
const saved={connection_preference:'both',experience_stage:'going_through',topics:['loneliness'],offer_encouragement:false,age_band:'16_17',review_status:'pending',consented_at:'2026-10-19',updated_at:'2026-10-19'};
function harness({enrollment=null,available=true,failure=false}={}){
 const states=[],effects=[],calls=[];let index=0,mounted=false,authListener;let currentUser={id:'owner'};let current={available,moderator:false,enrollment,reports:[]};
 const client={auth:{getUser:async()=>({data:{user:currentUser}}),onAuthStateChange:callback=>{authListener=callback;return{data:{subscription:{unsubscribe(){}}}};}},rpc:async(name,args)=>{
  calls.push([name,args]);if(name==='slm_state')return{data:current};if(failure)return{error:{}};
  if(name==='slm_join')current={...current,enrollment:{...saved,connection_preference:args.connection_choice,experience_stage:args.stage_choice,topics:args.topic_choices,offer_encouragement:args.encouragement,age_band:args.age_choice}};
  if(name==='slm_withdraw')current={...current,enrollment:null};return{data:null};
 }};
 const jsx=(type,props)=>({type,props});const labels=load('lib/someone-like-me.ts',{});
 const mod=load('components/WaitlistPreferences.tsx',{'react':{useState:v=>{const i=index++;if(!(i in states))states[i]=v;return[states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];},useRef:()=>({current:null}),useEffect:f=>{if(!mounted)effects.push(f);}},'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'link'},'@/lib/supabase':{supabase:client},'@/lib/someone-like-me':labels});
 return{calls,logout(){currentUser=null;authListener('SIGNED_OUT');},render(storyId){index=0;const n=nodes(mod.SomeoneLikeMe({storyId}));mounted=true;return n;},async mount(){for(const f of effects)f();await new Promise(setImmediate);}};
}
const button=(tree,label)=>tree.find(n=>n.type==='button'&&n.props.children===label);

test('SLM invitation is optional, gated by pilot activation, and never enrolls on impression/dismissal',async()=>{
 for(const available of [false,true]){const h=harness({available});h.render('own-story');await h.mount();let tree=h.render('own-story');assert.equal(Boolean(button(tree,'find someone who understands')),available);if(available)button(tree,'maybe later').props.onClick();assert(!h.calls.some(([name])=>name==='slm_join'));assert.equal(h.render('own-story').length,0);}
});
test('SLM sends only explicit topic/stage/age choices, then shows waitlist status without contact',async()=>{
 const h=harness();h.render('own-story');await h.mount();button(h.render('own-story'),'find someone who understands').props.onClick();
 let tree=h.render('own-story');let selects=tree.filter(n=>n.type==='select');
 selects[0].props.onChange({target:{value:'been_through'}});selects[1].props.onChange({target:{value:'both'}});selects[2].props.onChange({target:{value:'16_17'}});button(tree,'feeling left out').props.onClick();
 tree=h.render('own-story');assert.equal(button(tree,'Join the waitlist').props.disabled,true,'consent starts unchecked');
 const checks=tree.filter(n=>n.type==='input'&&n.props.type==='checkbox');checks[0].props.onChange({target:{checked:true}});checks[1].props.onChange({target:{checked:true}});
 tree=h.render('own-story');assert.equal(button(tree,'Join the waitlist').props.disabled,false);await tree.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 const joined=h.calls.find(([name])=>name==='slm_join')[1];assert.equal(joined.connection_choice,'been_through');assert.equal(joined.stage_choice,'both');assert.equal(joined.age_choice,'16_17');assert.equal(joined.encouragement,true);assert.equal(joined.consent,true);assert.equal(JSON.stringify(joined.topic_choices),'["feeling_left_out"]');
 assert(!('storyId'in joined));assert(!('user_id'in joined));assert(!('body'in joined));tree=h.render('own-story');assert(JSON.stringify(tree).includes('on the waitlist'));assert(!tree.some(n=>n.type==='textarea'));
});
test('SLM under-13 selections cannot submit; changing back to going-through removes encouragement offering',async()=>{
 const h=harness();h.render();await h.mount();button(h.render(),'find someone who understands').props.onClick();let tree=h.render();tree.filter(n=>n.type==='select')[1].props.onChange({target:{value:'both'}});tree=h.render();tree.filter(n=>n.type==='input')[0].props.onChange({target:{checked:true}});tree.filter(n=>n.type==='select')[1].props.onChange({target:{value:'going_through'}});tree.filter(n=>n.type==='select')[2].props.onChange({target:{value:'under_13'}});tree=h.render();assert.equal(tree.filter(n=>n.type==='input').length,1,'only consent remains');assert.equal(button(tree,'Join the waitlist').props.disabled,true);assert(!h.calls.some(([n])=>n==='slm_join'));
});
test('SLM withdrawal is deliberate, deletes matching fields from UI and remains available while intake is paused',async()=>{
 const h=harness({enrollment:saved,available:false});h.render();await h.mount();button(h.render(),'Leave and delete my preferences').props.onClick();assert(!h.calls.some(([n])=>n==='slm_withdraw'));await button(h.render(),'Yes, leave and delete').props.onClick();assert(h.calls.some(([n])=>n==='slm_withdraw'));assert(!JSON.stringify(h.render()).includes('loneliness'));assert(JSON.stringify(h.render()).includes('deleted'));
});
test('SLM failed opt-in stays retryable and does not claim participation',async()=>{
 const h=harness({failure:true});h.render();await h.mount();button(h.render(),'find someone who understands').props.onClick();await h.render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});const tree=h.render();assert(tree.some(n=>n.type==='form'));assert(JSON.stringify(tree).includes('couldn’t save'));assert(!JSON.stringify(tree).includes('You’re on the waitlist'));
});

test('SLM clears saved matching details from the screen when the account signs out',async()=>{
 const h=harness({enrollment:saved});h.render();await h.mount();assert(JSON.stringify(h.render()).includes('loneliness'));h.logout();assert(!JSON.stringify(h.render()).includes('loneliness'));await new Promise(resolve=>setTimeout(resolve,5));assert(JSON.stringify(h.render()).includes('Sign in'));assert(!h.calls.some(([n])=>n==='slm_join'));
});
