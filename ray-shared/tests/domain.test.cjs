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

test('shared forms use mobile validation and preserve edit and sharing payload semantics', () => {
  const { validateMomentForm, buildMomentPayload } = load('../momentForm.ts');
  const form = {
    isEdit: false, momentType: 'past', kind: 'sunrise', date: '2026-10-24',
    observedAt: '', title: '  Title  ', bibleVerse: '  Verse  ', reflection: '  ',
    locationName: '  Beach ', visibility: 'private', selectedPeople: new Set(), customRows: [],
  };
  assert.match(validateMomentForm(form, 0), /at least one photo/);
  assert.equal(validateMomentForm(form, 1), null);
  assert.equal(validateMomentForm({ ...form, isEdit: true }, 0), null);
  assert.equal(validateMomentForm({ ...form, momentType: 'looking_ahead' }, 0), null);
  assert.match(validateMomentForm({ ...form, visibility: 'tagged' }, 1), /person to tag/);
  assert.match(validateMomentForm({ ...form, visibility: 'custom', customRows: [{ userId: 0 }] }, 1), /at least one person/);
  const payload = buildMomentPayload(form);
  assert.equal(payload.title, 'Title');
  assert.equal(payload.bible_verse, 'Verse');
  assert.equal(payload.location_name, 'Beach');
  assert.equal(payload.reflection, undefined);
  assert.equal(payload.observed_at, null);
  assert.equal(payload.moment_type, 'past');
  assert.deepEqual(payload.people, []);
  assert(!('access' in payload));
  const tagged = { ...form, isEdit: true, visibility: 'tagged', selectedPeople: new Set([10, 20]) };
  assert.equal(validateMomentForm(tagged, 0), null);
  assert.deepEqual(buildMomentPayload(tagged).people, [{ person_id: 10, role: 'present' }, { person_id: 20, role: 'present' }]);
  assert(!('moment_type' in buildMomentPayload(tagged)), 'Editing cannot change the moment type without conversion');
  const custom = { ...form, visibility: 'custom', customRows: [{ userId: 0, accessLevel: 'view' }, { userId: 2, accessLevel: 'comment' }] };
  assert.equal(validateMomentForm(custom, 1), null);
  assert.deepEqual(buildMomentPayload(custom).access, [{ user_id: 2, access_level: 'comment' }]);
});

test('photo rules preserve aspect ratio, avoid upscaling, and match native size limits', () => {
  const rules = load('../photoRules.ts');
  assert.equal(rules.PHOTO_JPEG_QUALITY, 0.85);
  assert.deepEqual(rules.fitImageDimensions(4000, 3000, rules.MOMENT_MAX_PX), { width: 1600, height: 1200 });
  assert.deepEqual(rules.fitImageDimensions(3000, 4000, rules.MOMENT_MAX_PX), { width: 1200, height: 1600 });
  assert.deepEqual(rules.fitImageDimensions(1200, 1200, rules.AVATAR_MAX_PX), { width: 600, height: 600 });
  assert.deepEqual(rules.fitImageDimensions(200, 100, rules.MOMENT_MAX_PX), { width: 200, height: 100 });
  assert.throws(() => rules.fitImageDimensions(0, 100, 1600));
});

test('browser photo preparation applies shared JPEG rules and releases temporary URLs on failure', async () => {
  const { File } = require('node:buffer');
  const original = {
    Image: global.Image, document: global.document, File: global.File,
    create: URL.createObjectURL, revoke: URL.revokeObjectURL,
  };
  const revoked = [];
  const draws = [];
  let decodeFailure = false;
  let canvasFailure = false;
  let canvas;
  global.File = File;
  URL.createObjectURL = () => 'blob:test-photo';
  URL.revokeObjectURL = (uri) => revoked.push(uri);
  global.Image = class {
    naturalWidth = 4000;
    naturalHeight = 3000;
    set src(_) { queueMicrotask(() => decodeFailure ? this.onerror() : this.onload()); }
  };
  global.document = {
    createElement: () => {
      canvas = {
        getContext: () => ({ fillRect() {}, drawImage: (...args) => draws.push(args) }),
        toBlob: (callback, type, quality) => {
          assert.equal(type, 'image/jpeg');
          assert.equal(quality, 0.85);
          callback(canvasFailure ? null : new Blob(['jpeg'], { type }));
        },
      };
      return canvas;
    },
  };
  try {
    const { preparePhoto } = load('../../ray-web/src/photoUpload.ts');
    const file = new File(['original'], 'Sunset.png', { type: 'image/png', lastModified: 1234 });
    const result = await preparePhoto(file, 1600);
    assert.equal(result.name, 'Sunset.jpg');
    assert.equal(result.type, 'image/jpeg');
    assert.equal(result.lastModified, 1234);
    assert.deepEqual([canvas.width, canvas.height], [1600, 1200]);
    assert.deepEqual(draws[0].slice(1), [0, 0, 1600, 1200]);
    decodeFailure = true;
    await assert.rejects(preparePhoto(file, 600), /Could not read Sunset.png/);
    decodeFailure = false;
    canvasFailure = true;
    await assert.rejects(preparePhoto(file, 600), /Could not prepare Sunset.png/);
    assert.equal(revoked.length, 3);
  } finally {
    global.Image = original.Image;
    global.document = original.document;
    global.File = original.File;
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
  }
});

test('love heart hops stay reachable as it grows, with a distinct next position', () => {
  const { heartBounds, nextHeartPosition, clampHeart, heartSize, LOVE_HEART } = load('../loveHeart.ts');
  const insets = { top: 54, right: 0, bottom: 34, left: 0 };
  for (const [width, height] of [[393, 852], [852, 393], [320, 568], [1440, 900]]) {
    let point = { x: width, y: height };
    for (let tap = 0; tap < LOVE_HEART.taps; tap++) {
      const bounds = heartBounds(width, height, tap, insets);
      const previous = clampHeart(point, bounds);
      point = nextHeartPosition(bounds, previous, () => 0.45);
      assert(point.x >= bounds.minX && point.x <= bounds.maxX);
      assert(point.y >= bounds.minY && point.y <= bounds.maxY);
      const box = Math.max(44, heartSize(tap) + 12);
      assert(point.x + box <= width - insets.right);
      assert(point.y + box <= height - insets.bottom);
      assert(Math.hypot(point.x - previous.x, point.y - previous.y) > 0);
    }
  }
  assert(heartSize(4) > heartSize(3));
  assert.equal(heartSize(5), heartSize(4));
});

test('list hearts are add-only and respect reaction permissions', async () => {
  const { ensureMomentHeart, canHeartMoment } = load('../momentHeart.ts');
  assert.equal(canHeartMoment('view'), false);
  assert.equal(canHeartMoment(null), false);
  assert.equal(canHeartMoment('comment'), true);
  assert.equal(canHeartMoment('edit'), true);
  const mine = { user: 1, type: 'heart' };
  let adds = 0;
  const add = async () => { adds++; return mine; };
  assert.equal(await ensureMomentHeart(1, async () => [mine], add), 1);
  assert.equal(adds, 0);
  assert.equal(await ensureMomentHeart(1, async () => [{ user: 2, type: 'heart' }, { user: 1, type: 'wow' }], add), 3);
  assert.equal(adds, 1);
});

test('list hearts recover a duplicate or lost response without double counting', async () => {
  const { ensureMomentHeart } = load('../momentHeart.ts');
  let reads = 0;
  const read = async () => ++reads === 1 ? [] : [{ user: 1, type: 'heart' }];
  assert.equal(await ensureMomentHeart(1, read, async () => { throw new Error('duplicate'); }), 1);
  await assert.rejects(ensureMomentHeart(1, async () => [], async () => { throw new Error('offline'); }), /offline/);
  await assert.rejects(ensureMomentHeart(1, async () => { throw new Error('offline'); }, async () => { assert.fail('must not post without checking'); }), /offline/);
});
