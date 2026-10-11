const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');

const owner = '00000000-0000-4000-8000-000000000001';
const reader = '00000000-0000-4000-8000-000000000002';

test('database enforces response modes, retains history, and allows only authors to change modes', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create function auth.uid() returns uuid language sql as
        $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
      create function auth.role() returns text language sql as
        $$ select 'authenticated'::text $$;
      create role authenticated;
      create table public.users (id uuid primary key, username text not null);
      create table public.stories (id text primary key, user_id uuid, anonymous_name text,
        title text, reactions jsonb not null default '{}');
      create table public.comments (id serial primary key, story_id text references public.stories(id), body text);
      insert into users values ('${owner}', 'Author'), ('${reader}', 'Reader');
      insert into stories values ('legacy', null, 'Author', 'Original', '{"Girl stand up": 3}');
    `);
    const sql = fs.readFileSync(path.join(__dirname, '../supabase/response_preferences.sql'), 'utf8');
    await db.exec(sql);
    await db.exec(sql); // Deployment instructions promise a rerunnable migration.
    await db.exec(`grant usage on schema public, auth to authenticated;
      grant select, insert, update on public.stories, public.comments, public.users to authenticated;
      grant usage, select on all sequences in schema public to authenticated;
      set role authenticated; set test.user_id = '${owner}';`);

    await t.test('existing stories default to anything and keep their reactions', async () => {
      const row = (await db.query("select response_mode, reactions from stories where id = 'legacy'")).rows[0];
      assert.equal(row.response_mode, 'anything');
      assert.equal(row.reactions['Girl stand up'], 3);
      await db.exec("insert into comments (story_id, body) values ('legacy', 'An earlier reply')");
    });
    await t.test('legacy author can close replies without deleting earlier comments', async () => {
      await db.exec("update stories set response_mode = 'listen' where id = 'legacy'");
      await assert.rejects(db.exec("insert into comments (story_id, body) values ('legacy', 'New reply')"), /Replies are closed/);
      await assert.rejects(db.exec("update comments set body = 'Edited' where story_id = 'legacy'"), /Replies are closed/);
      await assert.rejects(db.exec(`update stories set reactions = '{"Girl stand up":4}' where id = 'legacy'`), /Reactions are closed/);
      assert.equal((await db.query("select count(*)::int as count from comments")).rows[0].count, 1);
      await db.exec("update stories set title = 'Edited title' where id = 'legacy'");
    });
    await t.test('comfort permits comments and Here for you, but blocks other changed reactions', async () => {
      await db.exec("update stories set response_mode = 'comfort' where id = 'legacy'");
      await db.exec("insert into comments (story_id, body) values ('legacy', 'Here with you')");
      await db.exec(`update stories set reactions = reactions || '{"Here for you":1}' where id = 'legacy'`);
      await assert.rejects(db.exec(`update stories set reactions = reactions || '{"Girl stand up":4}' where id = 'legacy'`), /Only supportive/);
      assert.equal((await db.query("select reactions from stories where id = 'legacy'")).rows[0].reactions['Girl stand up'], 3);
    });
    await t.test('advice permits Here for you and Team OP; anything restores ordinary reactions', async () => {
      await db.exec("update stories set response_mode = 'advice' where id = 'legacy'");
      await db.exec(`update stories set reactions = reactions || '{"Team OP":1}' where id = 'legacy'`);
      await assert.rejects(db.exec(`update stories set reactions = reactions || '{"This is insane":1}' where id = 'legacy'`), /Only supportive/);
      await db.exec("update stories set response_mode = 'anything' where id = 'legacy'");
      await db.exec(`update stories set reactions = reactions || '{"This is insane":1}' where id = 'legacy'`);
    });
    await t.test('reader cannot bypass disabled reactions by changing the response mode', async () => {
      await db.exec("update stories set response_mode = 'listen' where id = 'legacy'");
      await db.exec(`set test.user_id = '${reader}'`);
      await assert.rejects(db.exec("update stories set response_mode = 'anything' where id = 'legacy'"), /Only the author/);
      await assert.rejects(db.exec(`update stories set response_mode = 'anything', reactions = '{"Here for you":9}' where id = 'legacy'`), /Only the author/);
    });
    await t.test('user IDs take precedence over matching legacy display names', async () => {
      await db.exec(`reset role; insert into stories (id,user_id,anonymous_name,response_mode) values ('owned','${reader}','Author','listen'); set role authenticated; set test.user_id = '${owner}';`);
      await assert.rejects(db.exec("update stories set response_mode = 'anything' where id = 'owned'"), /Only the author/);
      await db.exec(`set test.user_id = '${reader}'; update stories set response_mode = 'comfort' where id = 'owned'`);
    });
    await t.test('invalid modes are rejected by the database', async () => {
      await assert.rejects(db.exec("update stories set response_mode = 'invalid' where id = 'owned'"), /check constraint/);
    });
  } finally {
    await db.close();
  }
});
