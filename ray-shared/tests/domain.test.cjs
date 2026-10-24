const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { createRequire } = require('node:module');
const ts = createRequire(path.resolve(__dirname, '../../ray-mobile/package.json'))('typescript');

function load(file) {
  const filename = path.resolve(__dirname, file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    (name) => load(path.relative(__dirname, path.resolve(path.dirname(filename), name + '.ts'))),
    module, module.exports,
  );
  return module.exports;
}
function withClock(iso, run) {
  const DateClass = Date;
  global.Date = class extends DateClass {
    constructor(...args) { super(...(args.length ? args : [iso])); }
    static now() { return new DateClass(iso).getTime(); }
  };
  try { run(); } finally { global.Date = DateClass; }
}
function moment(id, date, extra = {}) {
  return { id, date, author: 1, moment_type: 'looking_ahead', tagged_people: [], ...extra };
}

test('mobile and web retain the same date and preview rules across calendar boundaries', () => {
  const webDates = load('../../ray-web/src/formatSmartDate.ts');
  const mobileDates = load('../../ray-mobile/lib/formatSmartDate.ts');
  const webText = load('../../ray-web/src/truncateWords.ts');
  const mobileText = load('../../ray-mobile/lib/truncateWords.ts');
  const previousTZ = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    withClock('2026-03-09T12:00:00-04:00', () => {
      for (const [date, expected] of [
        ['2026-03-09', 'Today'], ['2026-03-08', 'Yesterday'],
        ['2026-03-02', '7d'], ['2026-03-10', 'Tomorrow'], ['2026-03-16', 'in 7d'],
      ]) {
        assert.equal(mobileDates.formatSmartDate(date), expected);
        assert.equal(webDates.formatSmartDate(date), expected);
      }
      for (const date of ['2025-12-31', '2026-02-01', 'bad-input']) {
        assert.equal(webDates.formatSmartDate(date), mobileDates.formatSmartDate(date));
      }
      for (const [iso, expected] of [
        ['2026-03-09T11:59:45-04:00', 'Just now'],
        ['2026-03-09T11:55:00-04:00', '5m ago'],
        ['2026-03-09T10:00:00-04:00', '2h ago'],
      ]) {
        assert.equal(webDates.formatSmartTimestamp(iso), expected);
        assert.equal(mobileDates.formatSmartTimestamp(iso), expected);
      }
      assert.equal(webDates.formatSmartDateTime('not-a-date'), '');
    });
    withClock('2027-01-01T12:00:00-05:00', () => {
      assert.equal(webDates.formatSmartDate('2026-12-31'), 'Yesterday');
      assert.match(mobileDates.formatSmartDate('2026-12-01'), /2026/);
    });
  } finally {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  }
  assert.equal(webText.LIST_REFLECTION_MAX_WORDS, 15);
  assert.equal(mobileText.LIST_BIBLE_VERSE_MAX_WORDS, 15);
  assert.equal(webText.truncateWords('  one \n two   three ', 2), 'one two\u2026');
  assert.equal(mobileText.truncateWords('  one \n two   three ', 2), 'one two\u2026');
  assert.equal(webText.truncateWords('one two', 2), 'one two');
});

test('both feeds preserve mobile sorting, tab membership, and separate upcoming summaries', () => {
  const reference = new Date(2026, 9, 24, 12);
  const web = load('../../ray-web/src/feed.ts');
  const mobile = load('../../ray-mobile/lib/feed.ts');
  const moments = [
    moment(8, '2026-10-20'), moment(3, '2026-10-25'), moment(7, '2026-10-23'),
    moment(2, '2026-10-24'), moment(1, '2026-10-24'), moment(9, 'invalid'),
    moment(10, '2026-10-23', { moment_type: 'past', author: 2 }),
    moment(11, '2026-10-23', { moment_type: 'past', tagged_people: [{ id: 40, linked_user: null }] }),
    moment(12, '2026-10-23', { moment_type: 'past', tagged_people: [{ id: 41, linked_user: 5 }] }),
  ];
  const original = structuredClone(moments);
  const viewer = { userId: 5, personId: 40, friendUserIds: new Set([2]) };
  const ids = (rows) => rows.map((row) => row.id);
  for (const rules of [web, mobile]) {
    assert.deepEqual(ids(rules.selectFeedMoments(moments, 'looking_ahead', viewer, reference)), [1, 2, 3, 7, 8, 9]);
    assert.deepEqual(ids(rules.selectUpcomingMoments(moments, reference)), [1, 2, 3]);
    assert.deepEqual(ids(rules.selectTimelineMoments(moments, 'all', reference)), [8, 7, 9, 10, 11, 12]);
    assert.deepEqual(ids(rules.selectFeedMoments(moments, 'friends', viewer, reference)), [10]);
    assert.deepEqual(ids(rules.selectFeedMoments(moments, 'mentions', viewer, reference)), [11, 12]);
    assert.deepEqual(ids(rules.selectFeedMoments(moments, 'mentions', { friendUserIds: new Set() }, reference)), []);
    assert.deepEqual(rules.selectFeedMoments([], 'all', viewer, reference), []);
  }
  assert.deepEqual(moments, original, 'Selecting and sorting never changes the input list');
});
