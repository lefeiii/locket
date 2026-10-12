const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('private host links submit once, expire, and require review before publishing; reply limits enforced',async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql as 'select null::uuid';
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz);
 create table public.users(id uuid primary key,username text);
 create table public.stories(id uuid primary key,user_id uuid,anonymous_name text,is_hidden boolean,is_private boolean,is_diary_only boolean);
 create table public.comments(story_id uuid,anonymous_name text);`);
 await db.exec(fs.readFileSync('supabase/host_invitations.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/awake_threads.sql','utf8'));
 const id='00000000-0000-4000-8000-000000000001';
 await db.query(`insert into auth.users values($1,'host@example.test',now(),null);`,[id]);
 await db.query(`insert into public.users values($1,'host')`,[id]);
 await db.query(`insert into public.host_invitations(night,user_id,username,state,token_digest,expires_at) values(current_date,$1,'host','sent','digest',now()+interval '1 hour')`,[id]);
 let r=await db.query(`select public.submit_awake_prompt('wrong','Question?') as result`);assert.equal(r.rows[0].result,false);
 r=await db.query(`select public.submit_awake_prompt('digest','Question?') as result`);assert.equal(r.rows[0].result,true);
 r=await db.query(`select public.submit_awake_prompt('digest','Replace?') as result`);assert.equal(r.rows[0].result,false);
 assert.equal((await db.query('select count(*)::int as count from public.awake_nights')).rows[0].count,0);
 r=await db.query(`select public.review_awake_prompt(current_date,true) as result`);assert.equal(r.rows[0].result,true);
 r=await db.query(`select public.review_awake_prompt(current_date,true) as result`);assert.equal(r.rows[0].result,false);
 assert.equal((await db.query('select prompt from public.awake_nights')).rows[0].prompt,'Question?');
 for(let i=0;i<10;i++)await db.query(`select public.add_awake_reply($1,current_date,'A reply')`,[id]);
 await assert.rejects(db.query(`select public.add_awake_reply($1,current_date,'Too many')`,[id]));
 await db.exec(`update public.host_invitations set prompt=null,review_state='pending',expires_at=now()-interval '1 hour'`);
 r=await db.query(`select public.submit_awake_prompt('digest','Late?') as result`);assert.equal(r.rows[0].result,false);
 const p=await db.query(`select has_function_privilege('anon','public.submit_awake_prompt(text,text)','execute') as anon,
 has_function_privilege('authenticated','public.review_awake_prompt(date,boolean)','execute') as member,
 has_function_privilege('service_role','public.review_awake_prompt(date,boolean)','execute') as service`);
 assert.deepEqual(p.rows[0],{anon:false,member:false,service:true});await db.close();
});
