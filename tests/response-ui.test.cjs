const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, require(name) {
    if (name === 'next/navigation') return { useRouter: () => ({ refresh() {} }) };
    if (name === '@/lib/supabase') return { supabase: null };
    if (name === '@/components/FollowButton') return { FollowButton: () => React.createElement('button', {}, 'Subscribe to story') };
    if (name === '@/components/ReportModal') return { ReportModal: () => null };
    if (name === 'next/link') return { default: ({ children, href, ...props }) => React.createElement('a', { href, ...props }, children), __esModule: true };
    if (name.startsWith('@/')) return load(name.slice(2) + (name.startsWith('@/components/') ? '.tsx' : '.ts'));
    return require(name);
  }});
  return loaded.exports;
}
const preferences = load('lib/response-mode.ts');
const { sampleStories } = load('lib/sample-data.ts');
const { StoryCard } = load('components/StoryCard.tsx');
const { CommentForm, InlineCommentForm } = load('components/CommentForm.tsx');
const { CommentSection } = load('components/CommentSection.tsx');
const { ResponseModeSelect } = load('components/ResponseModeSelect.tsx');

for (const mode of ['listen', 'comfort', 'advice', 'anything']) {
  test(mode + ' renders the correct metadata and interaction controls', () => {
    const markup = renderToStaticMarkup(React.createElement(StoryCard, {
      story: { ...sampleStories[0], has_active_poll: false, response_mode: mode },
    }));
    assert.ok(markup.includes(preferences.responseModes[mode].label));
    assert.ok(markup.includes('Part 1'));
    assert.equal(markup.includes('aria-label="Show comments"'), mode !== 'listen');
    assert.equal(markup.includes('I NEED THE UPDATE'), mode === 'anything');
    assert.equal(markup.includes('Here for you'), mode === 'comfort' || mode === 'advice');
    assert.equal(markup.includes('Team OP'), mode === 'advice' || mode === 'anything');
    assert.ok(markup.includes('Report story'));
    assert.ok(markup.includes('Subscribe to story'));
  });
}

test('both comment forms respect listen mode and use gentle mode-specific prompts', () => {
  for (const Form of [CommentForm, InlineCommentForm]) {
    assert.equal(renderToStaticMarkup(React.createElement(Form, { storyId: 'sample', responseMode: 'listen', onDone() {} })), '');
    for (const mode of ['comfort', 'advice']) {
      const html = renderToStaticMarkup(React.createElement(Form, { storyId: 'sample', responseMode: mode, onDone() {} }));
      assert.ok(html.includes(preferences.responseModes[mode].placeholder));
      assert.ok(html.includes(preferences.responseModes[mode].reminder));
    }
  }
  assert.equal(renderToStaticMarkup(React.createElement(CommentSection, { storyId: 'sample', comments: [], responseMode: 'listen' })), '');
});

test('old stories keep ordinary controls and the selector offers all four modes', () => {
  const html = renderToStaticMarkup(React.createElement(StoryCard, { story: sampleStories[0] }));
  assert.ok(html.includes('Anything welcome'));
  assert.ok(html.includes('I NEED THE UPDATE'));
  const select = renderToStaticMarkup(React.createElement(ResponseModeSelect, { value: 'comfort', onChange() {} }));
  assert.equal((select.match(/<option /g) ?? []).length, 4);
  assert.ok(select.includes('What do you need from readers?'));
  assert.equal(preferences.getResponseMode('unknown'), 'anything');
  assert.equal(preferences.isResponseMode('__proto__'), false);
});

if (process.env.RESPONSE_PREVIEW_PATH) {
  const cards = ['listen', 'comfort', 'advice', 'anything'].map(mode =>
    renderToStaticMarkup(React.createElement(StoryCard, { story: {
      ...sampleStories[0], response_mode: mode, has_active_poll: false,
      title: 'I can’t stop thinking of him',
      body: 'He keeps giving me mixed signals, and I don’t know what to think. I just needed somewhere to put this feeling.',
    } }))
  ).join('<div style="height:20px"></div>');
  fs.writeFileSync(process.env.RESPONSE_PREVIEW_PATH, '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="cozy.css"><main style="max-width:520px;margin:24px auto;padding:16px">'+cards+'</main>');
}
