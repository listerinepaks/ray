const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(__dirname, '..');

function load(file, imports = {}) {
  const source = fs.readFileSync(path.resolve(root, file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => {
    if (name in imports) return imports[name];
    if (name.endsWith('.css')) return {};
    if (name.startsWith('.')) return load(path.join(path.dirname(file), name + '.ts'), imports);
    if (name === 'react' || name === 'react/jsx-runtime') return require(name);
    throw new Error('Unexpected import: ' + name);
  }, module, module.exports);
  return module.exports;
}

function mockTimers() {
  const timers = [];
  const set = global.setTimeout, clear = global.clearTimeout;
  global.setTimeout = (callback, ms) => {
    const timer = { callback, ms, cleared: false };
    timers.push(timer);
    return timer;
  };
  global.clearTimeout = (timer) => { if (timer) timer.cleared = true; };
  return { timers, restore() { global.setTimeout = set; global.clearTimeout = clear; } };
}

for (const reduced of [false, true]) {
  test('native heart: five catches, celebration, cooldown and cleanup; reduced motion=' + reduced, async () => {
    const completed = [];
    class Value {
      constructor(value) { this.value = value; }
      setValue(value) { this.value = value; }
      stopAnimation(callback) { callback?.(this.value); }
      interpolate(options) { return options; }
    }
    class ValueXY extends Value {
      constructor(value = { x: 0, y: 0 }) { super(value); }
      getTranslateTransform() { return [{ translateX: this.value.x }, { translateY: this.value.y }]; }
    }
    const combine = (animations) => ({
      start(callback) { animations.forEach((animation) => animation.start()); if (callback) completed.push(callback); },
      stop() {},
    });
    const { FloatingLoveHeart } = load('components/FloatingLoveHeart.tsx', {
      '@expo/vector-icons': { Ionicons: 'icon' },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 54, right: 0, bottom: 34, left: 0 }) },
      'react-native': {
        View: 'view', Pressable: 'pressable',
        Modal: (props) => props.visible ? React.createElement('modal', props, props.children) : null,
        StyleSheet: { create: (value) => value, absoluteFill: {} },
        useWindowDimensions: () => ({ width: 393, height: 852 }),
        AccessibilityInfo: {
          isReduceMotionEnabled: async () => reduced,
          addEventListener: () => ({ remove() {} }),
        },
        Easing: { inOut: (v) => v, out: (v) => v, sin: 'sin', cubic: 'cubic' },
        Animated: {
          Value, ValueXY, View: 'animated-view',
          timing: (value, options) => ({ start() { value.setValue(options.toValue); }, stop() {} }),
          sequence: combine, parallel: combine, delay: () => ({ start() {}, stop() {} }),
          loop: () => ({ start() {}, stop() {} }),
        },
      },
    });
    let tree;
    const clock = mockTimers();
    try {
      await act(async () => { tree = create(React.createElement(FloatingLoveHeart)); });
      let previousSize = 0;
      for (let count = 0; count < 5; count++) {
        const button = tree.root.findByType('pressable');
        assert.equal(button.props.accessibilityLabel, 'Love heart, ' + count + ' of 5 taps');
        assert(button.props.style.width >= 44);
        const size = tree.root.findByType('icon').props.size;
        assert(size > previousSize);
        previousSize = size;
        await act(async () => { button.props.onPress(); });
      }
      assert.equal(tree.root.findAllByType('pressable').length, 0);
      const modal = tree.root.findByType('modal');
      await act(async () => { modal.props.onShow(); });
      assert.equal(tree.root.findAllByType('icon').length, reduced ? 1 : 19);
      await act(async () => { completed.at(-1)({ finished: true }); });
      assert.equal(tree.root.findAllByType('modal').length, 0);
      const cooldown = clock.timers.filter((timer) => !timer.cleared).at(-1);
      assert.equal(cooldown.ms, 12000);
      await act(async () => { cooldown.callback(); });
      assert.equal(tree.root.findByType('pressable').props.accessibilityLabel, 'Love heart, 0 of 5 taps');
      await act(async () => { tree.unmount(); });
      tree = null;
      assert(cooldown.cleared);
    } finally {
      if (tree) await act(async () => { tree.unmount(); });
      clock.restore();
    }
  });
}

test('web heart follows the same five-tap game, rejects extra taps, and resets after cooldown', async () => {
  const oldWindow = global.window, oldDocument = global.document;
  global.window = { innerWidth: 393, innerHeight: 852, addEventListener() {}, removeEventListener() {} };
  global.document = { body: {} };
  const { FloatingLoveHeart } = load('../ray-web/src/components/FloatingLoveHeart.tsx', {
    'react-dom': { createPortal: (child) => child },
  });
  const clock = mockTimers();
  let tree;
  try {
    await act(async () => { tree = create(React.createElement(FloatingLoveHeart)); });
    let handler;
    for (let count = 0; count < 5; count++) {
      const button = tree.root.findByType('button');
      handler = button.props.onClick;
      const rect = { left: button.props.style.left, top: button.props.style.top, width: button.props.style.width, height: button.props.style.height };
      await act(async () => { handler({ currentTarget: { getBoundingClientRect: () => rect } }); });
    }
    assert.equal(tree.root.findAllByType('button').length, 0);
    assert.equal(tree.root.findByProps({ className: 'love-heart-celebration' }).props['aria-hidden'], true);
    assert.equal(tree.root.findAllByProps({ className: 'love-heart-particle' }).length, 18);
    const timerCount = clock.timers.length;
    await act(async () => { handler({ currentTarget: { getBoundingClientRect() { throw new Error('Extra taps must be ignored'); } } }); });
    assert.equal(clock.timers.length, timerCount);
    const celebration = clock.timers.filter((timer) => !timer.cleared).at(-1);
    assert.equal(celebration.ms, 1870);
    await act(async () => { celebration.callback(); });
    assert.equal(tree.root.findAllByProps({ className: 'love-heart-celebration' }).length, 0);
    const cooldown = clock.timers.filter((timer) => !timer.cleared).at(-1);
    assert.equal(cooldown.ms, 12000);
    await act(async () => { cooldown.callback(); });
    assert.equal(tree.root.findByType('button').props['aria-label'], 'Love heart, 0 of 5 taps');
    await act(async () => { tree.unmount(); });
    tree = null;
  } finally {
    if (tree) await act(async () => { tree.unmount(); });
    clock.restore();
    global.window = oldWindow;
    global.document = oldDocument;
  }
});
