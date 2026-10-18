const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('email queue respects consent, arcs, grouping, privacy, unsubscribe and exclusive claims',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.uid',true),'')::uuid $$;
 create table public.users(id uuid primary key,username text);
 create table public.stories(id uuid primary key,user_id uuid,anonymous_name text,story_arc_id text,is_update boolean,part_number integer,is_hidden boolean default false,is_private boolean default false,is_diary_only boolean default false);
 create table public.comments(id uuid primary key,story_id uuid,anonymous_name text);
 create table public.story_follows(user_id uuid,story_id uuid);
 `);
 // PGlite has no pgcrypto; substitute only cryptographic token generation in this test.
 let sql=fs.readFileSync('supabase/email_notifications.sql','utf8').replace('create extension if not exists pgcrypto;','').replace("encode(gen_random_bytes(32), 'hex')","replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')");
 await db.exec(sql);
 await db.exec(sql); // migration is repeatable
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 const first='33333333-3333-4333-8333-333333333333',next='44444444-4444-4444-8444-444444444444';
 await db.exec(`insert into auth.users values('${a}','a@example.com',now()),('${b}','b@example.com',now()); insert into public.users values('${a}','a'),('${b}','b');
 insert into public.email_delivery_preferences(user_id) values('${a}'),('${b}');
 insert into public.stories(id,user_id,anonymous_name,story_arc_id,is_update,part_number) values('${first}','${a}','a','${first}',false,1);
 insert into public.story_follows values('${b}','${first}');
 insert into public.stories(id,user_id,anonymous_name,story_arc_id,is_update,part_number) values('${next}','${a}','a','${first}',true,2);`);
 const count=async()=> (await db.query('select count(*)::int n from public.email_delivery_queue')).rows[0].n;
 assert.equal(await count(),0,'default opt out');
 await db.exec(`update public.email_delivery_preferences set story_updates=true,replies=true;
 insert into public.stories(id,user_id,anonymous_name,story_arc_id,is_update,part_number) values(gen_random_uuid(),'${a}','a','${first}',false,1);
 insert into public.stories(id,user_id,anonymous_name,story_arc_id,is_update,part_number,is_private) values(gen_random_uuid(),'${a}','a','${first}',true,3,true);`);
 assert.equal(await count(),0,'standalones and private updates ignored');
 await db.exec(`insert into public.stories(id,user_id,anonymous_name,story_arc_id,is_update,part_number) values(gen_random_uuid(),'${a}','a','${first}',true,3);`);
 assert.equal(await count(),1);
 await db.exec(`select set_config('request.uid','${b}',false); insert into public.comments values(gen_random_uuid(),'${first}','b'),(gen_random_uuid(),'${first}','b');`);
 const grouped=(await db.query("select event_count,due_at>now() delayed from public.email_delivery_queue where kind='replies'")).rows;
 assert.equal(grouped[0].event_count,2);assert.equal(grouped[0].delayed,true);
 await db.exec(`select set_config('request.uid','${a}',false); insert into public.comments values(gen_random_uuid(),'${first}','a');`);
 assert.equal(await count(),2,'self replies ignored');
 let claimed=(await db.query('select * from public.claim_locket_emails()')).rows;
 assert.equal(claimed.length,1,'reply digest not due yet');
 assert.equal((await db.query('select * from public.claim_locket_emails()')).rows.length,0,'claimed mail never replayed');
 assert.equal((await db.query('select public.locket_email_still_allowed($1) allowed',[claimed[0].id])).rows[0].allowed,true);
 await db.exec(`delete from public.story_follows;`);
 assert.equal((await db.query('select public.locket_email_still_allowed($1) allowed',[claimed[0].id])).rows[0].allowed,false,'unfollowing prevents send');
 const token=(await db.query(`select unsubscribe_token from public.email_delivery_preferences where user_id='${a}'`)).rows[0].unsubscribe_token;
 await db.query('select public.unsubscribe_locket_email($1)',[token]);
 assert.equal(await count(),1,'unsubscribe clears pending replies');
 await db.exec(`grant usage on schema auth to authenticated; select set_config('request.uid','${a}',false); set role authenticated;`);
 await db.query(`insert into public.email_delivery_preferences(user_id,story_updates,replies) values('${a}',false,true) on conflict(user_id) do update set user_id=excluded.user_id,story_updates=excluded.story_updates,replies=excluded.replies`);
 await assert.rejects(db.query(`update public.email_delivery_preferences set unsubscribe_token='forged' where user_id='${a}'`));
 await assert.rejects(db.query(`insert into public.email_delivery_preferences(user_id) values(gen_random_uuid())`));
 await db.exec('reset role; set role anon');
 await assert.rejects(db.query('select * from public.email_delivery_queue'));
 await assert.rejects(db.query('select * from public.claim_locket_emails()'));
 await db.query('select public.unsubscribe_locket_email($1)',[token]);
 }finally{await db.close();}
});
