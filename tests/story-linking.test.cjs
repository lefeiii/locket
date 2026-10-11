const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadModule(filename, dependencies = {}, globals = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", filename), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    exports: loaded.exports, module: loaded, process, ...globals,
    require: name => {
      if (name in dependencies) return dependencies[name];
      if (name === "@/components/ResponseModeSelect") return { ResponseModeSelect: "response-select" };
      if (name === "@/lib/response-mode") return loadModule("lib/response-mode.ts");
      if (name === "@/lib/sample-data") return loadModule("lib/sample-data.ts");
      return require(name);
    },
  });
  return loaded.exports;
}
const linking = loadModule("lib/story-linking.ts");
const uid = "00000000-0000-4000-8000-000000000001";
const rootId = "00000000-0000-4000-8000-000000000002";
const newId = "00000000-0000-4000-8000-000000000003";
const root = () => ({
  id: rootId, user_id: uid, anonymous_name: "Author", title: "Original story",
  story_arc_id: "legacy-title-arc", arc_title: "Original story", part_number: 1,
});

function database(stories, failures = {}) {
  return { from(table) {
    let filters = [], order, cap, patch, insertion, owner, countQuery = false;
    const query = {
      select(_fields, options) { countQuery = Boolean(options?.head); return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      is(key, value) { filters.push(row => (row[key] ?? null) === value); return query; },
      or(expression) {
        owner = expression.match(/user_id.eq.([^,]+)/)[1];
        filters.push(row => !row.user_id || row.user_id === owner); return query;
      },
      gte() { return query; },
      order(key) { order = key; return query; },
      limit(value) { cap = value; return query; },
      update(value) { patch = value; return query; },
      insert(value) { insertion = value; return query; },
      maybeSingle() { return query.then(result => result); },
      single() { return query.then(result => result); },
      then(resolve, reject) {
        if (table === "users") return Promise.resolve({ data: { username: "Author" } }).then(resolve, reject);
        if (countQuery) return Promise.resolve({ count: 0 }).then(resolve, reject);
        if (insertion) {
          stories.push(insertion);
          return Promise.resolve({ data: { id: insertion.id } }).then(resolve, reject);
        }
        let rows = stories.filter(row => filters.every(matches => matches(row)));
        if (patch) {
          if (failures.update) return Promise.resolve({ error: new Error("write failed") }).then(resolve, reject);
          rows.forEach(row => Object.assign(row, patch));
          return Promise.resolve({ error: null }).then(resolve, reject);
        }
        if (failures.read || (failures.parts && order)) {
          return Promise.resolve({ error: new Error("read failed") }).then(resolve, reject);
        }
        if (order) rows.sort((a, b) => (b[order] ?? 0) - (a[order] ?? 0));
        if (cap) rows = rows.slice(0, cap);
        return Promise.resolve({ data: rows[0] ?? null, error: null }).then(resolve, reject);
      },
    };
    return query;
  } };
}

test("different update titles join the selected arc; number follows the highest part", async () => {
  const parent = root();
  const rows = [parent, { ...parent, id: newId, part_number: 4, is_hidden: true }];
  const result = await linking.resolveStoryLink(database(rows), uid, "Author", newId, "A totally different title", true, rootId);
  assert.equal(result.story_arc_id, parent.story_arc_id);
  assert.equal(result.part_number, 5);
  assert.equal(result.previous_story_reference, parent.title);
});

test("choosing any later part continues the same arc", async () => {
  const parent = { ...root(), id: newId, part_number: 2, title: "Second part" };
  const rows = [root(), parent, { ...root(), id: "third", part_number: 3 }];
  const result = await linking.resolveStoryLink(database(rows), uid, "Author", rootId, "Next", true, newId);
  assert.equal(result.story_arc_id, root().story_arc_id);
  assert.equal(result.part_number, 4);
});

test("old unlinked original receives an arc so both original and update have navigation", async () => {
  const parent = { ...root(), story_arc_id: null, arc_title: null };
  const result = await linking.resolveStoryLink(database([parent]), uid, "Author", newId, "Update", true, rootId);
  assert.equal(parent.story_arc_id, rootId);
  assert.equal(parent.update_label, "Part 1");
  assert.equal(result.story_arc_id, rootId);
  assert.equal(result.part_number, 2);
});

test("legacy posts without user_id remain selectable by their account owner", async () => {
  const parent = { ...root(), user_id: null };
  const result = await linking.resolveStoryLink(database([parent]), uid, "Author", newId, "Update", true, rootId);
  assert.equal(result.part_number, 2);
});

for (const [name, change] of [
  ["another author's story", { user_id: "someone-else" }],
  ["another author's legacy story", { user_id: null, anonymous_name: "Other" }],
  ["hidden story", { is_hidden: true }],
  ["private story", { is_private: true }],
  ["diary-only story", { is_diary_only: true }],
]) {
  test("rejects " + name, async () => {
    await assert.rejects(
      linking.resolveStoryLink(database([{ ...root(), ...change }]), uid, "Author", newId, "Update", true, rootId),
      error => error instanceof linking.StoryLinkError && error.status === 400
    );
  });
}

test("requires a selected story and rejects missing/deleted stories", async () => {
  for (const id of [undefined, "", "a typed title", rootId]) {
    await assert.rejects(linking.resolveStoryLink(database([]), uid, "Author", newId, "Update", true, id));
  }
});

test("same titles and legacy arc IDs belonging to different authors do not affect numbering", async () => {
  const rows = [root(), { ...root(), id: newId, anonymous_name: "Other", user_id: "other", part_number: 50 }];
  const result = await linking.resolveStoryLink(database(rows), uid, "Author", newId, "Update", true, rootId);
  assert.equal(result.part_number, 2);
  const first = await linking.resolveStoryLink(database([]), uid, "Author", rootId, "Same title", false);
  const second = await linking.resolveStoryLink(database([]), uid, "Author", newId, "Same title", false);
  assert.notEqual(first.story_arc_id, second.story_arc_id);
});

test("database failures stop posting rather than silently starting a new arc", async () => {
  for (const failures of [{ read: true }, { parts: true }, { update: true }]) {
    await assert.rejects(
      linking.resolveStoryLink(database([{ ...root(), story_arc_id: failures.update ? null : "arc" }], failures),
        uid, "Author", newId, "Update", true, rootId),
      error => error.status === 500
    );
  }
});

test("posting route overrides forged client ownership and numbering", async () => {
  const rows = [root()];
  const db = database(rows);
  const route = loadModule("app/api/submit-story/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    "@supabase/supabase-js": { createClient: () => ({
      ...db, auth: { getUser: async () => ({ data: { user: { id: uid } } }) },
    }) },
    "node:crypto": { randomUUID: () => newId },
    "@/lib/story-linking": linking,
    "@/lib/safety": { findSafetyIssues: () => [] },
  });
  const response = await route.POST({
    headers: { get: () => "Bearer token" },
    json: async () => ({
      previousStoryId: rootId,
      payload: {
        title: "Different title", body: "An update", is_update: true, response_mode: "comfort",
        user_id: "forged", anonymous_name: "Other", story_arc_id: "forged-arc",
        part_number: 99, update_label: "Part 99",
      },
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(rows[1].user_id, uid);
  assert.equal(rows[1].anonymous_name, "Author");
  assert.equal(rows[1].story_arc_id, root().story_arc_id);
  assert.equal(rows[1].part_number, 2);
  assert.equal(rows[1].update_label, "Part 2");
  assert.equal(rows[1].response_mode, "comfort");
});

test("dropdown loads every page of the author's public stories and submits the selected ID", async () => {
  let slots = [], index = 0, effect, posted;
  const ranges = [];
  const records = Array.from({ length: 205 }, (_, i) => ({
    ...root(), id: `story-${i}`, created_at: "2026-10-10T00:00:00Z",
    user_id: i === 0 ? null : uid,
    is_private: i === 1, is_diary_only: i === 2,
  }));
  records[3].user_id = "other";
  const jsx = (type, props) => ({ type, props });
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: uid } } }),
      getSession: async () => ({ data: { session: { access_token: "token" } } }),
    },
    from(table) {
      const q = {
        select() { return q; }, eq() { return q; }, order() { return q; },
        single: async () => ({ data: { username: "Author" } }),
        range: async (first, last) => {
          assert.equal(table, "stories"); ranges.push([first, last]);
          return { data: records.slice(first, last + 1) };
        },
      };
      return q;
    },
  };
  const router = { push() {} };
  const formModule = loadModule("app/create/page.tsx", {
    "react": {
      useState(initial) {
        const position = index++;
        if (!(position in slots)) slots[position] = initial;
        return [slots[position], next => { slots[position] = typeof next === "function" ? next(slots[position]) : next; }];
      },
      useMemo: compute => compute(),
      useEffect: callback => { effect = callback; },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": {}, "next/link": { default: "link" },
    "next/navigation": { useRouter: () => router },
    "@/components/AppNav": {},
    "@/lib/sample-data": { categories: [], emptyReactions: () => ({}) },
    "@/lib/safety": { findSafetyIssues: () => [] },
    "@/lib/supabase": { supabase: client },
  }, {
    fetch: async (_url, options) => {
      posted = JSON.parse(options.body);
      return { ok: false, json: async () => ({ error: "Test complete" }) };
    },
  });
  function nodes(tree) {
    if (!tree || typeof tree !== "object") return [];
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    return [tree, ...nodes(tree.props?.children)];
  }
  function render() { index = 0; return nodes(formModule.default()); }
  render(); effect();
  await new Promise(setImmediate);
  assert.deepEqual(ranges, [[0, 199], [200, 399]]);
  let all = render();
  all.find(n => n.type === "input" && n.props.type === "checkbox").props.onChange({ target: { checked: true } });
  all = render();
  const dropdown = all.find(n => n.type === "select" && n.props.required);
  assert.equal(nodes(dropdown).filter(n => n.type === "option").length, 203);
  assert.equal(all.find(n => n.type === "button" && n.props.type === "submit").props.disabled, true);
  dropdown.props.onChange({ target: { value: "story-204" } });
  all = render();
  assert.equal(all.find(n => n.type === "button" && n.props.type === "submit").props.disabled, false);
  all.find(n => n.type === "input" && n.props.required).props.onChange({ target: { value: "A different update title" } });
  all.find(n => n.type === "textarea").props.onChange({ target: { value: "The update body" } });
  all = render();
  await all.find(n => n.type === "form").props.onSubmit({ preventDefault() {} });
  assert.equal(posted.previousStoryId, "story-204");
  assert.equal("story_arc_id" in posted.payload, false);
  assert.equal("part_number" in posted.payload, false);
});


test("an empty legacy arc ID is linked to the original story ID", async () => {
  const parent = { ...root(), story_arc_id: "", arc_title: null };
  const result = await linking.resolveStoryLink(database([parent]), uid, "Author", newId, "Update", true, rootId);
  assert.equal(parent.story_arc_id, rootId);
  assert.equal(result.part_number, 2);
});


test("posting route rejects invalid response modes before inserting", async () => {
  const route = loadModule("app/api/submit-story/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    "@supabase/supabase-js": { createClient: () => { throw new Error("Must not reach insertion"); } },
    "@/lib/story-linking": linking,
    "@/lib/safety": { findSafetyIssues: () => [] },
  });
  const response = await route.POST({ json: async () => ({ payload: { title: "Hello", body: "A story", response_mode: "invalid" } }) });
  assert.equal(response.status, 400);
});
