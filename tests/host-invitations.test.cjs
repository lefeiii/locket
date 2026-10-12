const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
test('host lottery requires consent, claims once, and restricts access',async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql as 'select null::uuid';
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz);
 create table public.users(id uuid primary key,username text);
 create table public.stories(id uuid primary key,user_id uuid,anonymous_name text,is_hidden boolean,is_private boolean,is_diary_only boolean);
 create table public.comments(story_id uuid,anonymous_name text);`);
 await db.exec(fs.readFileSync('supabase/host_invitations.sql','utf8'));
 const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
 await db.query(`insert into auth.users values($1,'first@example.test',now(),null),($2,'second@example.test',now(),null)`,[a,b]);
 await db.query(`insert into public.users values($1,'cinnaxx'),($2,'volunteer')`,[a,b]);
 await db.query(`insert into public.stories values($1,$1,'cinnaxx',false,false,false),($2,$2,'volunteer',false,false,false)`,[a,b]);
 const draw=async()=> (await db.query(`select public.claim_host_invitation((now() at time zone 'America/Toronto')::date,'cinnaxx') as result`)).rows[0].result;
 assert.equal((await draw()).username,'cinnaxx');assert.equal(await draw(),null);
 await db.exec('update public.host_invitations set night=night-1');
 assert.equal(await draw(),null);
 await db.query('insert into public.host_invite_preferences values($1,true)',[b]);
 assert.equal((await draw()).username,'volunteer');
 const p=await db.query(`select has_function_privilege('anon','public.claim_host_invitation(date,text)','execute') as anon,
 has_function_privilege('authenticated','public.claim_host_invitation(date,text)','execute') as member,
 has_function_privilege('service_role','public.claim_host_invitation(date,text)','execute') as service`);
 assert.deepEqual(p.rows[0],{anon:false,member:false,service:true});await db.close();
});
