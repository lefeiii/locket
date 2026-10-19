const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',M='44444444-4444-4444-8444-444444444444';
async function fixture(){
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.uid',true),'')::uuid$$;grant usage on schema auth to authenticated;
 create table public.users(id uuid primary key,username text);create table public.stories(id uuid primary key,user_id uuid,anonymous_name text,created_at timestamptz,is_hidden boolean,is_private boolean,is_diary_only boolean);
 insert into auth.users values('${A}',now()),('${B}',now()),('${C}',now()),('${M}',now());insert into public.users values('${A}','a'),('${B}','b'),('${C}','c'),('${M}','m');`);
 await db.exec(fs.readFileSync('supabase/someone_like_me.sql','utf8'));const sql=fs.readFileSync('supabase/someone_like_me_connections.sql','utf8');await db.exec(sql);await db.exec(sql);
 const as=async uid=>{await db.exec('reset role');await db.query("select set_config('request.uid',$1,false)",[uid??'']);await db.exec('set role authenticated');};const admin=async sql=>{await db.exec('reset role');return db.exec(sql);};
 await admin(`insert into public.slm_moderators values('${M}');update public.slm_config set enabled=true;`);
 for(const uid of[A,B,C]){await as(uid);await db.query("select public.slm_join('both','both',array['loneliness'],true,'16_17',true)");}
 await admin("update public.slm_enrollments set review_status='reviewed_waitlist',updated_at=now()-interval '10 seconds';");
 const open=()=>admin("update public.slm_contact_config set enabled=true,age_assurance_ready=true,age_process_reference='fixture_external_process',coverage_confirmed_at=now(),coverage_until=now()+interval '12 hours';");
 const consent=async uid=>{await as(uid);await db.query('select public.slm_contact_optin(true)');};
 const age=async(uid,band='16_17')=>{await as(M);return db.query('select public.slm_attest_age($1,$2,now()+interval \'1 day\',$3,true)',[uid,band,'opaque_case_'+uid.slice(0,8)]);};
 const pair=async()=>{await as(M);const participants=(await db.query('select public.slm_contact_review() data')).rows[0].data.participants;return(await db.query('select public.slm_propose_introduction($1,$2,true,$3,$4) id',[A,B,participants.find(p=>p.id===A).updated_at,participants.find(p=>p.id===B).updated_at])).rows[0].id;};
 const ready=async()=>{await open();await consent(A);await consent(B);await age(A);await age(B);return pair();};
 const accept=async(uid,id)=>{await as(uid);await db.query("select public.slm_respond_introduction($1,'accept',true)",[id]);};
 const chat=async(uid,id)=>{await as(uid);return(await db.query('select public.slm_conversation($1) data',[id])).rows[0].data;};
 return{db,as,admin,open,consent,age,pair,ready,accept,chat};
}

test('contact pilot is off by default, requires separate consent, current external same-band checks and independent review',async()=>{
 const f=await fixture();try{
 await f.as(A);assert.equal((await f.db.query('select public.slm_contact_state() data')).rows[0].data.enabled,false);
 await assert.rejects(f.db.query('select public.slm_contact_optin(false)'),/consent/);await assert.rejects(f.db.query('select * from public.slm_messages'),/permission denied/);
 await assert.rejects(f.db.query('select public.slm_attest_age($1,$2,now()+interval \'1 day\',$3,true)',[A,'16_17','case_123']),/Moderator/);
 await f.consent(A);await f.consent(B);await assert.rejects(f.age(A),/external age/);await f.open();await assert.rejects(f.pair(),/external age/);
 await f.age(A);await f.age(B);const id=await f.pair();await f.as(C);await assert.rejects(f.db.query("select public.slm_respond_introduction($1,'accept',true)",[id]),/not available/);
 await assert.rejects(f.db.query('select public.slm_contact_review()'),/Moderator/);
 await f.as(A);await assert.rejects(f.db.query("select public.slm_respond_introduction($1,'accept',false)",[id]),/consent/);
 await f.accept(A,id);await assert.rejects(f.chat(A,id),/not available/);await f.accept(B,id);const view=await f.chat(A,id);assert.equal(view.can_send,true);assert.equal(view.messages.length,0);
 for(const field of ['user_a','user_b','username','email','story','author_id'])assert.equal(field in view,false);
 await f.as(A);await assert.rejects(f.db.query('select public.slm_attest_age($1,$2,now()+interval \'1 day\',$3,true)',[A,'16_17','case_123']),/Moderator/);
 await f.admin(`insert into public.slm_moderators values('${A}')`);await f.as(A);await assert.rejects(f.db.query('select public.slm_attest_age($1,$2,now()+interval \'1 day\',$3,true)',[A,'16_17','case_123']),/own age/);
 }finally{await f.db.close();}
});

test('adult/minor or incompatible introductions are denied; coverage, consent, age expiry and preference changes fail closed',async()=>{
 const f=await fixture();try{
 await f.open();await f.consent(A);await f.consent(B);
 await f.admin(`update public.slm_enrollments set age_band='18_plus' where user_id='${B}'`);await f.age(A);await f.age(B,'18_plus');await assert.rejects(f.pair(),/same age band/);
 await f.admin(`update public.slm_enrollments set age_band='16_17' where user_id='${B}'`);await f.age(B);
 await f.admin(`update public.slm_enrollments set topics=array['family'] where user_id='${B}'`);await assert.rejects(f.pair(),/Shared topics/);
 await f.admin(`update public.slm_enrollments set topics=array['loneliness'],connection_preference='been_through',experience_stage='going_through',offer_encouragement=false where user_id='${B}'`);await f.admin(`update public.slm_enrollments set connection_preference='been_through' where user_id='${A}'`);await assert.rejects(f.pair(),/compatible/);
 await f.admin(`update public.slm_enrollments set connection_preference='both',experience_stage='both',offer_encouragement=true where user_id='${B}'`);
 await f.admin(`update public.slm_enrollments set connection_preference='both' where user_id='${A}'`);
 const id=await f.pair();await f.accept(A,id);await f.accept(B,id);
 await f.admin("update public.slm_contact_config set coverage_until=now()-interval '1 second'");assert.equal((await f.chat(A,id)).can_send,false);await f.as(A);await assert.rejects(f.db.query('select public.slm_send_message($1,$2)',[id,'A safe note']),/not ready/);
 await f.open();await f.admin(`update public.slm_age_assurance set valid_until=now()-interval '1 second' where user_id='${B}'`);assert.equal((await f.chat(A,id)).can_send,false);
 await f.age(B);await f.admin(`update public.slm_enrollments set updated_at=now() where user_id='${A}'`);assert.equal((await f.chat(A,id)).state,'closed');
 }finally{await f.db.close();}
});

test('messages are premoderated; peer/outsider cannot see pending text; contacts and rate abuse are blocked',async()=>{
 const f=await fixture();try{
 const id=await f.ready();await f.accept(A,id);await f.accept(B,id);await f.as(A);
 for(const text of ['','hello https://example.com','email me a@example.com','phone 123-456-7890','find @myhandle'])await assert.rejects(f.db.query('select public.slm_send_message($1,$2)',[id,text]),/without links/);
 await f.db.query('select public.slm_send_message($1,$2)',[id,'I have felt left out too.']);await f.db.query('select public.slm_send_message($1,$2)',[id,'You are not alone.']);await assert.rejects(f.db.query('select public.slm_send_message($1,$2)',[id,'Another note']),/wait for review/);
 const own=await f.chat(A,id);assert.equal(own.messages.length,2);assert(own.messages.every(m=>m.from_me&&m.status==='pending'));
 assert.equal((await f.chat(B,id)).messages.length,0);await assert.rejects(f.chat(C,id),/not available/);
 await f.as(B);await assert.rejects(f.db.query("select public.slm_review_message($1,'approve')",[own.messages[0].id]),/Moderator/);
 await f.as(M);await f.db.query("select public.slm_review_message($1,'approve')",[own.messages[0].id]);await assert.rejects(f.db.query("select public.slm_review_message($1,'approve')",[own.messages[0].id]),/Pending message/);
 const peer=await f.chat(B,id);assert.equal(peer.messages.length,1);assert.equal(peer.messages[0].from_me,false);assert.equal('author_id'in peer.messages[0],false);
 await f.admin(`insert into public.slm_moderators values('${A}')`);await f.as(A);await assert.rejects(f.db.query("select public.slm_review_message($1,'approve')",[own.messages[1].id]),/own conversation/);
 const selfQueue=(await f.db.query('select public.slm_contact_review() data')).rows[0].data;assert.equal(selfQueue.pending_messages.length,0);assert.equal(selfQueue.introductions.length,0);
 }finally{await f.db.close();}
});

test('reporting pauses delivery and preserves restricted evidence; blocking prevents further approval or reopening',async()=>{
 const f=await fixture();try{
 const id=await f.ready();await f.accept(A,id);await f.accept(B,id);await f.as(A);await f.db.query('select public.slm_send_message($1,$2)',[id,'A peer message.']);const msg=(await f.chat(A,id)).messages[0];
 await f.as(M);await f.db.query("select public.slm_review_message($1,'approve')",[msg.id]);await f.as(B);await f.db.query("select public.slm_report_contact($1,$2,'harassment')",[id,msg.id]);assert.equal((await f.chat(A,id)).can_send,false);
 await f.as(M);let queue=(await f.db.query('select public.slm_contact_review() data')).rows[0].data;assert.equal(queue.reports[0].evidence,'A peer message.');const report=queue.reports[0].id;
 await f.db.query("select public.slm_resolve_contact_report($1,'resume')",[report]);assert.equal((await f.chat(A,id)).can_send,true);
 await f.as(A);await f.db.query('select public.slm_send_message($1,$2)',[id,'A new pending message.']);const pending=(await f.chat(A,id)).messages.find(m=>m.status==='pending');
 await f.as(B);await f.db.query('select public.slm_end_contact($1,true)',[id]);assert.equal((await f.chat(A,id)).state,'closed');await f.as(M);await assert.rejects(f.db.query("select public.slm_review_message($1,'approve')",[pending.id]),/Pending message/);
 await f.as(B);await f.db.query("select public.slm_report_contact($1,null,'unwanted_contact')",[id]);await f.as(M);queue=(await f.db.query('select public.slm_contact_review() data')).rows[0].data;await assert.rejects(f.db.query("select public.slm_resolve_contact_report($1,'resume')",[queue.reports[0].id]),/Cannot resume/);
 await f.as(A);await f.db.query('select public.slm_contact_feedback_save($1,$2)',[id,'somewhat']);await f.db.query('select public.slm_contact_withdraw()');await assert.rejects(f.chat(B,id),/not available/);
 await f.as(M);queue=(await f.db.query('select public.slm_contact_review() data')).rows[0].data;assert.equal(queue.introductions.length,0);assert(queue.reports.length>0);assert.equal(queue.reports[0].intro_id,null);
 await f.admin('');assert.equal((await f.db.query('select count(*)::int n from public.slm_contact_blocks')).rows[0].n,1);assert.equal((await f.db.query('select count(*)::int n from public.slm_messages')).rows[0].n,0);
 // A fresh consent cannot bypass a retained block.
 await f.consent(A);await f.age(A);await assert.rejects(f.pair(),/no block/);
 await f.admin(`delete from public.users where id='${B}'`);assert.equal((await f.db.query('select count(*)::int n from public.slm_contact_reports')).rows[0].n,0);assert.equal((await f.db.query('select count(*)::int n from public.slm_contact_blocks')).rows[0].n,0);
 }finally{await f.db.close();}
});

test('urgent triage cannot be approved, expired/declined invitations never open, and anonymous RPC access is denied',async()=>{
 const f=await fixture();try{
 const id=await f.ready();await f.accept(A,id);await f.accept(B,id);await f.as(A);await f.db.query('select public.slm_send_message($1,$2)',[id,'I want to hurt myself.']);const msg=(await f.chat(A,id)).messages[0];await f.as(M);await assert.rejects(f.db.query("select public.slm_review_message($1,'approve')",[msg.id]),/Cannot deliver/);await f.db.query("select public.slm_review_message($1,'hold_safety')",[msg.id]);assert.equal((await f.chat(B,id)).messages.length,0);assert.equal((await f.chat(B,id)).can_send,false);
 await f.as(M);await f.db.query("select public.slm_moderate_conversation($1,'end')",[id]);assert.equal((await f.chat(A,id)).state,'closed');
 await f.admin('set role anon');await assert.rejects(f.db.query('select public.slm_contact_state()'),/permission denied/);await assert.rejects(f.db.query('select public.slm_contact_review()'),/permission denied/);
 }finally{await f.db.close();}
 const g=await fixture();try{const id=await g.ready();await g.admin("update public.slm_introductions set expires_at=now()-interval '1 second'");await assert.rejects(g.accept(A,id),/safeguards/);await g.as(A);await g.db.query("select public.slm_respond_introduction($1,'decline',false)",[id]);await assert.rejects(g.accept(B,id),/no longer/);await assert.rejects(g.chat(A,id),/not available/);}finally{await g.db.close();}
});
