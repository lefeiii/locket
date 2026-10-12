const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const loaded = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../lib/story-updates.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
vm.runInNewContext(code, { exports: loaded.exports, module: loaded });
const { isStoryUpdate } = loaded.exports;
const update = { id: "second", is_update: true, story_arc_id: "original", part_number: 2 };

test("linked parts 2 and higher belong in Updates", () => {
  for (const part_number of [2, 3, 4, 10]) {
    assert.equal(isStoryUpdate({ ...update, part_number }), true);
  }
});

test("standalone and original stories stay out even with a stale update flag", () => {
  for (const patch of [
    { part_number: 1 }, { part_number: null }, { part_number: undefined },
    { story_arc_id: null }, { story_arc_id: "" }, { story_arc_id: "second" },
    { is_update: false },
  ]) {
    assert.equal(isStoryUpdate({ ...update, ...patch }), false);
  }
});
