const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');

const root = path.resolve(__dirname, '..');
global.IS_REACT_ACT_ENVIRONMENT = true;

// Exercise the actual TS modules with native components mocked at the boundary.
function loadModule(file, imports = {}) {
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)((name) => {
    if (name in imports) return imports[name];
    if (name.startsWith('.')) return loadModule(path.join(path.dirname(file), name + '.ts'), imports);
    if (name === 'react' || name === 'react/jsx-runtime') return require(name);
    throw new Error('Unexpected import: ' + name);
  }, module, module.exports);
  return module.exports;
}

function moment(id, extra = {}) {
  return {
    id, author: 1, author_username: 'Me', title: 'Moment ' + id,
    moment_type: 'past', kind: 'sunrise', date: '2026-10-24', observed_at: null,
    created_at: '2026-10-24T12:00:00Z', updated_at: '2026-10-24T12:00:00Z',
    photos: [], tagged_people: [], reflection: '', bible_verse: '', location_name: '',
    my_access: 'edit', visibility_mode: 'private', ...extra,
  };
}
const photo = { id: 10, image: '/original.jpg', thumbnail: '/thumb.jpg', caption: '', sort_order: 0 };

test('confirmed writes immediately update the feed, including photos and partial saves', async () => {
  const feed = loadModule('lib/momentFeed.ts');
  const api = loadModule('lib/api.ts', { './momentFeed': feed });
  const originalFetch = global.fetch;
  let rows = [moment(1)];
  const events = [];
  const unsubscribe = feed.subscribeToMomentFeed((change) => {
    events.push(change);
    rows = feed.applyMomentFeedChange(rows, change);
  });
  let reply;
  global.fetch = async (uri) => {
    if (uri === 'file:///picked.jpg') return { ok: true, blob: async () => new Blob(['photo']) };
    return {
      ok: reply.status < 400, status: reply.status,
      json: async () => reply.body,
      text: async () => JSON.stringify(reply.body),
    };
  };
  const respond = (body, status = 200) => { reply = { body, status }; };
  try {
    api.setApiToken('session-one');
    respond(moment(2));
    await api.createMoment({});
    assert.deepEqual(rows.map((row) => row.id), [2, 1]);

    respond(photo);
    await api.uploadMomentPhoto(2, { uri: 'file:///picked.jpg', type: 'image/jpeg', name: 'photo.jpg' }, '', 0);
    assert.deepEqual(rows[0].photos, [photo], 'Uploaded photo is visible before a list reload');

    respond({ detail: 'Upload failed' }, 500);
    await assert.rejects(api.uploadMomentPhoto(2, { uri: 'file:///picked.jpg', type: 'image/jpeg', name: 'next.jpg' }, '', 1));
    assert.deepEqual(rows[0].photos, [photo], 'A failed later upload preserves the confirmed post and first photo');

    respond({ ...photo, caption: 'Updated caption' });
    await api.patchMomentPhoto(2, 10, { caption: 'Updated caption' });
    assert.equal(rows[0].photos[0].caption, 'Updated caption');
    respond(null, 204);
    await api.deleteMomentPhoto(2, 10);
    assert.equal(rows[0].photos.length, 0);

    respond(moment(2, { date: '2026-10-23', title: 'Edited' }));
    await api.updateMoment(2, {});
    assert.deepEqual(rows.map((row) => row.id), [1, 2], 'Editing the date reorders the feed');
    assert.equal(rows[1].title, 'Edited');
    respond(moment(2, { title: 'Converted' }));
    await api.postConvertMoment(2);
    assert.equal(rows[0].title, 'Converted');

    const beforeFailure = events.length;
    respond({ detail: 'Forbidden' }, 403);
    await assert.rejects(api.deleteMoment(2));
    assert.equal(events.length, beforeFailure);
    assert.equal(rows.length, 2);
    respond(null, 204);
    await api.deleteMoment(2);
    assert.deepEqual(rows.map((row) => row.id), [1]);

    let finish;
    global.fetch = () => new Promise((resolve) => { finish = resolve; });
    const pending = api.createMoment({});
    api.setApiToken('session-two');
    finish({ ok: true, json: async () => moment(99) });
    await pending;
    assert.deepEqual(rows.map((row) => row.id), [1], 'An old account request cannot update a new session');
  } finally {
    unsubscribe();
    global.fetch = originalFetch;
  }
});

test('five-minute focus freshness, immediate local changes, refresh override, and late-response protection', async () => {
  const feed = loadModule('lib/momentFeed.ts');
  let focused = true;
  let now = 1_000_000;
  const realNow = Date.now;
  Date.now = () => now;
  let calls = 0;
  let serverRows = [moment(1)];
  let deferredList = null;
  const api = {
    fetchMoments: () => {
      calls++;
      return deferredList || Promise.resolve(serverRows);
    },
    fetchFriendships: async () => ({ accepted: [], pending_incoming: [] }),
    fetchNotifications: async () => ({ unread_count: 0 }),
    fetchProfile: async () => ({ avatar: null, display_name: 'Me' }),
    acceptFriendRequest: async () => {},
    mediaUrl: (uri) => uri || '',
  };
  const user = { id: 1, username: 'Me', groups: [] };
  const router = { push() {} };
  const navigation = { setOptions() {} };
  const { default: Timeline } = loadModule('app/(app)/index.tsx', {
    '@expo/vector-icons': { Ionicons: 'icon' },
    'expo-router/react-navigation': {
      useFocusEffect: (callback) => React.useEffect(() => focused ? callback() : undefined, [callback, focused]),
    },
    'expo-location': { requestForegroundPermissionsAsync: async () => ({ status: 'denied' }) },
    'expo-router': { useRouter: () => router, useNavigation: () => navigation },
    'expo-image': { Image: 'image' },
    'expo-linear-gradient': { LinearGradient: 'gradient' },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'animated-view' },
      interpolate: () => 0, useAnimatedStyle: (callback) => callback(),
      useSharedValue: (value) => ({ value }), Extrapolation: { CLAMP: 'clamp' },
    },
    'react-native': {
      ActivityIndicator: 'spinner', Pressable: 'pressable', RefreshControl: 'refresh',
      ScrollView: 'scroll', Text: 'text', View: 'view',
      StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
      Platform: { OS: 'ios', select: (values) => values.ios || values.default },
      useWindowDimensions: () => ({ width: 390, height: 844 }),
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/components/AspectFitImage': { AspectFitImage: 'aspect-image' },
    '@/components/MomentPhotoCarousel': { MomentPhotoCarousel: 'carousel' },
    '@/components/RayLogo': { RayLogo: 'logo' },
    '@/contexts/AuthContext': { useAuth: () => ({ user }) },
    '@/constants/theme': { theme: {}, fonts: {} },
    '@/lib/formatSmartDate': { formatSmartDate: (date) => date },
    '@/lib/sunTimes': {},
    '@/lib/truncateWords': { truncateWords: (text) => text, LIST_BIBLE_VERSE_MAX_WORDS: 15, LIST_REFLECTION_MAX_WORDS: 15 },
    '@/lib/api': api,
    '@/lib/imageCache': { MEMORY_DISK_CACHE_POLICY: 'memory-disk' },
    '@/lib/momentFeed': feed,
    '@/lib/feed': loadModule('lib/feed.ts'),
  });
  let tree;
  const text = () => tree.root.findAllByType('text')
    .flatMap((node) => node.children.filter((child) => typeof child === 'string'))
    .join(' ');
  const focus = async (value) => {
    focused = value;
    await act(async () => { tree.update(React.createElement(Timeline)); });
  };
  try {
    await act(async () => { tree = create(React.createElement(Timeline)); });
    assert.equal(calls, 1, 'Initial focus loads exactly once');
    await focus(false);
    now += 40_000;
    await focus(true);
    assert.equal(calls, 1, 'Returning after 40 seconds reuses the list');

    await focus(false);
    const created = moment(2, { title: 'Just posted' });
    await act(async () => { feed.publishMomentFeedChange({ type: 'upsert', moment: created }); });
    assert(text().includes('Just posted'));
    assert.equal(calls, 1, 'A background list does not refetch for each photo upload');

    let finish;
    deferredList = new Promise((resolve) => { finish = resolve; });
    await focus(true);
    assert.equal(calls, 2, 'Own writes bypass the five-minute timer');
    assert(text().includes('Just posted'), 'Confirmed content stays visible while reconciling');

    await act(async () => {
      feed.publishMomentFeedChange({ type: 'upsert', moment: { ...created, title: 'New edit' } });
      feed.publishMomentFeedChange({ type: 'photo-upsert', momentId: 2, photo });
      feed.publishMomentFeedChange({ type: 'remove', momentId: 1 });
    });
    await act(async () => { finish([created, moment(1)]); });
    assert(text().includes('New edit'));
    assert(!text().includes('Moment 1'));
    assert.equal(tree.root.findByType('aspect-image').props.uri, '/thumb.jpg',
      'Late responses cannot undo an edit, photo upload, or deletion');

    deferredList = null;
    serverRows = [{ ...created, title: 'New edit', photos: [photo] }];
    await focus(false);
    await focus(true);
    assert.equal(calls, 3, 'Writes during a request leave it dirty for the next focus');

    await focus(false);
    now += feed.FEED_STALE_MS - 1;
    await focus(true);
    assert.equal(calls, 3);
    await focus(false);
    now += 1;
    await focus(true);
    assert.equal(calls, 4, 'Five minutes triggers a background refresh');

    const refresh = tree.root.findByType('scroll').props.refreshControl;
    await act(async () => { refresh.props.onRefresh(); });
    assert.equal(calls, 5, 'Pull-to-refresh always bypasses freshness');
    assert.equal(tree.root.findByType('scroll').props.refreshControl.props.refreshing, false);

    await focus(false);
    now += feed.FEED_STALE_MS;
    let finishOld;
    deferredList = new Promise((resolve) => { finishOld = resolve; });
    await focus(true);
    assert.equal(calls, 6);
    deferredList = null;
    serverRows = [{ ...created, title: 'Newest server version', photos: [photo] }];
    await act(async () => {
      tree.root.findByType('scroll').props.refreshControl.props.onRefresh();
    });
    assert.equal(calls, 7, 'Manual refresh can supersede an already running request');
    await act(async () => { finishOld([moment(1)]); });
    assert(text().includes('Newest server version'));
    assert(!text().includes('Moment 1'), 'The superseded response cannot replace newer data');

    await focus(false);
    await act(async () => { tree.unmount(); });
    tree = null;
    feed.publishMomentFeedChange({ type: 'remove', momentId: 2 });
  } finally {
    if (tree) await act(async () => { tree.unmount(); });
    Date.now = realNow;
  }
});
