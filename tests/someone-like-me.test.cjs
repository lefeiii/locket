const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222', MOD='33333333-3333-4333-8333-333333333333', UNVERIFIED='44444444-4444-4444-8444-444444444444';
const STORY='55555555-5555-4555-8555-555555555555', PRIVATE='66666666-6666-4666-8666-666666666666';
async function fixture() {
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.uid',true),'')::uuid $$;
 grant usage on schema auth to authenticated;
 create table public.users(id uuid primary key,username text unique);
 create table public.stories(id uuid primary key,user_id uuid,anonymous_name text,created_at timestamptz default now(),is_private boolean default false,is_diary_only boolean default false,is_hidden boolean default false);
 insert into auth.users values('${A}',now()),('${B}',now()),('${MOD}',now()),('${UNVERIFIED}',null);
 insert into public.users values('${A}','A'),('${B}','B');
 insert into public.stories(id,user_id,anonymous_name) values('${STORY}','${A}','A');
 insert into public.stories(id,user_id,anonymous_name,is_private) values('${PRIVATE}','${A}','A',true);`);
 const sql=fs.readFileSync('supabase/someone_like_me.sql','utf8');
 await db.exec(sql); await db.exec(sql);
 const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.uid',$1,false)",[id??'']);await db.exec('set role authenticated');};
 const admin=async sql=>{await db.exec('reset role');return db.exec(sql);};
 const state=async()=> (await db.query('select public.slm_state() data')).rows[0].data;
 const join=async overrides=>{const x={connection:'both',stage:'going_through',topics:['feeling_left_out'],encourage:false,age:'16_17',consent:true,...overrides};return db.query('select public.slm_join($1,$2,$3,$4,$5,$6)',[x.connection,x.stage,x.topics,x.encourage,x.age,x.consent]);};
 const open=()=>admin(`insert into public.slm_moderators values('${MOD}');update public.slm_config set enabled=true;`);
 return {db,as,admin,state,join,open};
}

test('SLM install is repeatable, off by default, and requires explicit valid choices and verified authentication',async()=>{
 const f=await fixture();try{
 await f.as(A);assert.equal((await f.state()).available,false);assert.equal((await f.state()).enrollment,null);
 await assert.rejects(f.join(),/paused/);await f.admin('update public.slm_config set enabled=true');await f.as(A);assert.equal((await f.state()).available,false,'intake fails closed without a moderator');await assert.rejects(f.join(),/paused/);await f.open();await f.as(A);
 for(const changes of [{consent:false},{consent:null},{age:'under_13'},{age:'unknown'},{topics:[]},{topics:['invented']},{topics:['loneliness','loneliness']},{topics:['family',null]},{topics:['family','loneliness','school_stress','relationships']},{connection:'secret'},{stage:'diagnosed_by_ai'},{encourage:true}])await assert.rejects(f.join(changes));
 await f.as(null);await assert.rejects(f.join(),/Sign in/);await assert.rejects(f.state(),/Sign in/);
 await f.as(UNVERIFIED);await assert.rejects(f.join(),/Verified/);
 await f.as(A);await f.join();const enrollment=(await f.state()).enrollment;
 assert.equal(enrollment.experience_stage,'going_through');assert.equal(enrollment.review_status,'pending');assert.equal(enrollment.consent_version,'slm-waitlist-v1');assert.equal(enrollment.offer_encouragement,false);
 assert.equal('user_id' in enrollment,false);assert.equal('story_id' in enrollment,false);assert.equal('body' in enrollment,false);
 await assert.rejects(f.join(),/wait a moment/);
 }finally{await f.db.close();}
});

test('SLM isolates participants and moderators; review never permits contact or age verification',async()=>{
 const f=await fixture();try{
 await f.open();await f.as(A);await f.join({stage:'been_through',encourage:true,age:'18_plus'});
 const timestamp=(await f.state()).enrollment.updated_at;
 await assert.rejects(f.db.query('select * from public.slm_enrollments'),/permission denied/);
 await assert.rejects(f.db.query(`insert into public.slm_moderators values('${A}')`),/permission denied/);
 await f.as(B);assert.equal((await f.state()).enrollment,null);
 await assert.rejects(f.db.query('select public.slm_review_queue()'),/Moderator/);
 await assert.rejects(f.db.query('select public.slm_metrics()'),/Moderator/);
 await assert.rejects(f.db.query('select public.slm_review_participant($1,$2,$3)',[A,'reviewed_waitlist',timestamp]),/Moderator/);
 await f.as(MOD);const queue=(await f.db.query('select public.slm_review_queue() data')).rows[0].data;
 assert.equal(queue.enrollments.length,1);assert.equal(queue.enrollments[0].age_band,'18_plus');assert.equal(queue.enrollments[0].offer_encouragement,true);
 for(const field of ['email','username','anonymous_name','body','story_id'])assert.equal(field in queue.enrollments[0],false);
 await assert.rejects(f.db.query('select public.slm_review_participant($1,$2,$3)',[A,'match_approved',timestamp]),/Invalid/);
 await f.db.query('select public.slm_review_participant($1,$2,$3)',[A,'paused',timestamp]);
 await assert.rejects(f.db.query('select public.slm_review_participant($1,$2,$3)',[A,'pending',timestamp]),/changed/);
 await f.admin(`update public.slm_enrollments set updated_at=now()-interval '10 seconds' where user_id='${A}'`);
 await f.as(A);await f.join({topics:['family']});assert.equal((await f.state()).enrollment.review_status,'paused','editing cannot bypass a pause');
 await f.as(MOD);const metrics=(await f.db.query('select public.slm_metrics() data')).rows[0].data;
 assert.equal(metrics.conversations_enabled,false);assert.equal(metrics.mutual_acceptances,null);assert.equal(metrics.feeling_understood,null);
 await f.admin('set role anon');await assert.rejects(f.db.query('select public.slm_state()'),/permission denied/);
 }finally{await f.db.close();}
});

test('SLM counts impressions once for own recent public stories; records return days only after consent',async()=>{
 const f=await fixture();try{
 await f.open();await f.as(B);await assert.rejects(f.db.query('select public.slm_record_impression($1)',[STORY]),/own public story/);
 await f.as(A);await assert.rejects(f.db.query('select public.slm_record_impression($1)',[PRIVATE]),/own public story/);
 await f.db.query('select public.slm_record_impression($1)',[STORY]);await f.db.query('select public.slm_record_impression($1)',[STORY]);
 await f.db.query('select public.slm_record_return()');
 await f.admin('');assert.equal((await f.db.query('select count(*)::int n from public.slm_visits')).rows[0].n,0);
 await f.as(A);await f.join();await f.db.query('select public.slm_record_return()');await f.db.query('select public.slm_record_return()');
 await f.admin(`update public.slm_enrollments set consented_at=now()-interval '7 days' where user_id='${A}'`);
 await f.as(MOD);let metrics=(await f.db.query('select public.slm_metrics() data')).rows[0].data;
 assert.equal(metrics.invitation_impressions,1);assert.equal(metrics.optin_events,1);assert.equal(metrics.seven_day_mature_cohort,1);assert.equal(metrics.seven_day_mature_returners,1);
 await f.admin(`update public.slm_enrollments set consented_at=now()-interval '10 days';delete from public.slm_visits;`);
 await f.as(A);await f.db.query('select public.slm_record_return()');await f.admin('');assert.equal((await f.db.query('select count(*)::int n from public.slm_visits')).rows[0].n,0,'tracking window is bounded');
 }finally{await f.db.close();}
});

test('SLM withdrawal deletes preferences, visits, impressions, review history; safety reports remain restricted',async()=>{
 const f=await fixture();try{
 await f.open();await f.as(A);await f.join();const timestamp=(await f.state()).enrollment.updated_at;
 await f.db.query('select public.slm_record_impression($1)',[STORY]);
 await f.db.query("select public.slm_report_concern('urgent_safety')");
 await assert.rejects(f.db.query("select public.slm_report_concern('sensitive free text')"),/Choose/);
 await f.db.query("select public.slm_report_concern('unwanted_contact')");await f.db.query("select public.slm_report_concern('privacy')");await assert.rejects(f.db.query("select public.slm_report_concern('privacy')"),/wait/);
 await f.as(B);assert.deepEqual((await f.state()).reports,[]);
 await assert.rejects(f.db.query("select * from public.slm_safety_reports"),/permission denied/);
 await f.as(MOD);await f.db.query('select public.slm_review_participant($1,$2,$3)',[A,'reviewed_waitlist',timestamp]);
 const report=(await f.db.query('select public.slm_review_queue() data')).rows[0].data.reports[0];assert.equal(report.category,'urgent_safety');
 await f.db.query('select public.slm_close_report($1)',[report.id]);
 await f.as(A);await f.db.query('select public.slm_withdraw()');await f.db.query('select public.slm_withdraw()');
 const state=await f.state();assert.equal(state.enrollment,null);assert.equal(state.reports.length,3);
 await f.admin('update public.slm_config set enabled=false');
 for(const table of ['slm_enrollments','slm_visits','slm_impressions','slm_review_log'])assert.equal((await f.db.query(`select count(*)::int n from public.${table}`)).rows[0].n,0,table);
 await f.as(MOD);const metrics=(await f.db.query('select public.slm_metrics() data')).rows[0].data;assert.equal(metrics.withdrawal_events,1);assert.equal(metrics.current_participants,0);assert.equal(metrics.safety_reports,3);
 await f.admin(`delete from auth.users where id='${A}'`);assert.equal((await f.db.query('select count(*)::int n from public.slm_safety_reports')).rows[0].n,0);
 await f.admin('update public.slm_config set enabled=true');await f.as(B);await f.join();await f.db.query("select public.slm_report_concern('privacy')");
 await f.admin(`delete from public.users where id='${B}'`);
 assert.equal((await f.db.query('select count(*)::int n from public.slm_enrollments')).rows[0].n,0,'existing profile-delete flow clears enrollment');
 assert.equal((await f.db.query('select count(*)::int n from public.slm_safety_reports')).rows[0].n,0,'existing profile-delete flow clears reports');
 }finally{await f.db.close();}
});
