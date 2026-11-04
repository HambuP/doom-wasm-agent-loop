#!/usr/bin/env node
// Acceptance checks for the DOOM WebAssembly port. See tests/CRITERIA.md.
// Usage: node tests/run_all.js [--run-id ID] [--skip-build] [--headed] [--self-test]
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
// T1 floor; lowered from 500 KiB, see tests/CRITERIA.md "Criteria changes".
const MIN_WASM_BYTES = 300 * 1024;
const WAD_SIZE = fs.existsSync(path.join(ROOT, 'assets/doom1.wad'))
  ? fs.statSync(path.join(ROOT, 'assets/doom1.wad')).size : 4196020;

// ---------- helpers shared with play.js ----------

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

function gitInfo() {
  const run = (a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  const status = run(['status', '--porcelain']);
  return { commit: run(['rev-parse', 'HEAD']), dirty: status.length > 0, status };
}

function runDir(runId) {
  const dir = path.join(ROOT, 'artifacts', 'runs', runId, 'tests');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm',
  '.data': 'application/octet-stream', '.css': 'text/css', '.json': 'application/json',
};

function serve(dir) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(dir, url === '/' ? 'index.html' : url);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () =>
    resolve({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}

// Returns { w, h, data: Array } of the #canvas contents (RGBA).
async function grab(page) {
  const r = await page.evaluate(() => {
    const c = document.getElementById('canvas');
    const o = document.createElement('canvas');
    o.width = c.width; o.height = c.height;
    const ctx = o.getContext('2d');
    ctx.drawImage(c, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    return { w: c.width, h: c.height, data: Array.from(d) };
  });
  return r;
}

// Sample every 4th pixel in x and y, optionally within a fractional region.
function samples(f, region = { x0: 0, y0: 0, x1: 1, y1: 1 }) {
  const out = [];
  const xs = Math.floor(region.x0 * f.w), xe = Math.floor(region.x1 * f.w);
  const ys = Math.floor(region.y0 * f.h), ye = Math.floor(region.y1 * f.h);
  for (let y = ys; y < ye; y += 4) for (let x = xs; x < xe; x += 4) {
    const i = (y * f.w + x) * 4;
    out.push([f.data[i], f.data[i + 1], f.data[i + 2], f.data[i + 3]]);
  }
  return out;
}

function stats(f) {
  const s = samples(f);
  const counts = new Map();
  let alphaBad = 0;
  for (const [r, g, b, a] of s) {
    const k = (r << 16) | (g << 8) | b;
    counts.set(k, (counts.get(k) || 0) + 1);
    if (a !== 255) alphaBad++;
  }
  const top = Math.max(0, ...counts.values());
  return { distinct: counts.size, topFrac: s.length ? top / s.length : 1, alphaBad, n: s.length };
}

function diffFrac(a, b, region) {
  const sa = samples(a, region), sb = samples(b, region);
  if (!sa.length || sa.length !== sb.length) return 0;
  let d = 0;
  for (let i = 0; i < sa.length; i++) {
    const [r1, g1, b1] = sa[i], [r2, g2, b2] = sb[i];
    if (Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) > 48) d++;
  }
  return d / sa.length;
}

// T4 predicate, also used by the negative controls.
function frameLooksRendered(f) {
  const s = stats(f);
  const reasons = [];
  if (s.distinct < 16) reasons.push(`only ${s.distinct} distinct colors (<16)`);
  if (s.topFrac >= 0.9) reasons.push(`${(s.topFrac * 100).toFixed(1)}% one color (>=90%)`);
  if (s.alphaBad > 0) reasons.push(`${s.alphaBad}/${s.n} sampled pixels alpha != 255`);
  return { ok: reasons.length === 0, reasons, stats: s };
}

const REGION_STATUS = { x0: 0, y0: 0.84, x1: 1, y1: 1 };
const REGION_AMMO = { x0: 0, y0: 0.84, x1: 0.15, y1: 1 };
// Title logo (red "DOOM" letters) and the 3D view above the status bar.
const REGION_LOGO = { x0: 0.2, y0: 0.15, x1: 0.8, y1: 0.5 };
const REGION_VIEW = { x0: 0.1, y0: 0.15, x1: 0.9, y1: 0.7 };

// T9 predicate: count clearly red-dominant vs. blue-dominant samples.
function redBlueBalance(f, region) {
  let red = 0, blue = 0;
  for (const [r, , b] of samples(f, region)) {
    if (r > b + 40) red++; else if (b > r + 40) blue++;
  }
  return { red, blue, ok: red > 2 * blue && red > 0 };
}

async function frameCountDelta(page, ms) {
  const a = await page.evaluate(() => window.doomFrameCount | 0);
  await page.waitForTimeout(ms);
  const b = await page.evaluate(() => window.doomFrameCount | 0);
  return b - a;
}

async function hold(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

async function tap(page, key, gap = 400) {
  await page.keyboard.down(key);
  await page.waitForTimeout(120);
  await page.keyboard.up(key);
  await page.waitForTimeout(gap);
}

// Navigate title -> menu -> New Game -> episode -> skill. Returns frames.
async function startNewGame(page) {
  const title = await grab(page);
  await tap(page, 'Escape', 800);
  const menu = await grab(page);
  await tap(page, 'Enter', 600);
  await tap(page, 'Enter', 600);
  await tap(page, 'Enter', 3000);
  const level = await grab(page);
  return { title, menu, level };
}

async function openGame(chromium, url, { headed } = {}) {
  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const log = { consoleErrors: [], pageErrors: [], failed: [], bad: [], requests: [], wasmType: null, crashed: false };
  page.on('console', (m) => { if (m.type() === 'error') log.consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => log.pageErrors.push(String(e)));
  page.on('crash', () => { log.crashed = true; });
  page.on('requestfailed', (r) => log.failed.push(`${r.url()} ${r.failure() && r.failure().errorText}`));
  page.on('request', (r) => log.requests.push(r.url()));
  page.on('response', (r) => {
    if (r.status() >= 400) log.bad.push(`${r.status()} ${r.url()}`);
    if (r.url().endsWith('.wasm')) log.wasmType = r.headers()['content-type'];
  });
  await page.goto(url);
  return { browser, page, log };
}

// ---------- self-test (negative controls) ----------

function synth(w, h, fn) {
  const data = new Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b, a] = fn(x, y); const i = (y * w + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
  }
  return { w, h, data };
}

function selfTest() {
  const W = 320, H = 200;
  const noise = synth(W, H, (x, y) => [(x * 7 + y * 13) & 255, (x * 3) & 255, (y * 5) & 255, 255]);
  const noise2 = synth(W, H, (x, y) => [(x * 11 + y) & 255, (y * 9) & 255, (x * 5 + 40) & 255, 255]);
  const black = synth(W, H, () => [0, 0, 0, 255]);
  const transparent = synth(W, H, (x, y) => [(x * 7 + y * 13) & 255, (x * 3) & 255, (y * 5) & 255, 0]);
  const mostlyOne = synth(W, H, (x, y) => (x < 300 ? [20, 20, 20, 255] : [x & 255, y & 255, 9, 255]));
  const reddish = synth(W, H, (x, y) => [180 + (x & 63), (y * 3) & 63, (x + y) & 31, 255]);
  const swapped = { ...reddish, data: reddish.data.slice() };
  for (let i = 0; i < swapped.data.length; i += 4) [swapped.data[i], swapped.data[i + 2]] = [swapped.data[i + 2], swapped.data[i]];
  const cases = [
    ['realistic frame accepted by T4', frameLooksRendered(noise).ok === true],
    ['blank frame rejected by T4', frameLooksRendered(black).ok === false],
    ['alpha-0 (BGRX) frame rejected by T4', frameLooksRendered(transparent).ok === false],
    ['single-color-dominated frame rejected by T4', frameLooksRendered(mostlyOne).ok === false],
    ['identical frames rejected by change checks', diffFrac(noise, noise) < 0.02],
    ['different frames accepted by change checks', diffFrac(noise, noise2) >= 0.10],
    ['ammo region unchanged rejected by T6', diffFrac(noise, noise, REGION_AMMO) < 0.01],
    ['red frame accepted by T9', redBlueBalance(reddish, REGION_LOGO).ok === true],
    ['R/B-swapped frame rejected by T9', redBlueBalance(swapped, REGION_LOGO).ok === false],
    ['moving view rejected by T10', diffFrac(noise, noise2, REGION_VIEW) >= 0.10],
  ];
  let ok = true;
  for (const [name, pass] of cases) {
    console.log(`${pass ? 'PASS' : 'FAIL'}  self-test: ${name}`);
    ok = ok && pass;
  }
  return ok;
}

// ---------- main ----------

async function main() {
  if (process.argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1);

  const runId = arg('--run-id', process.env.RUN_ID || `test-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const outDir = runDir(runId);
  const headed = process.argv.includes('--headed');
  const results = { runId, startedAt: new Date().toISOString(), git: gitInfo(), checks: [] };
  const shot = (page, name) => page.screenshot({ path: path.join(outDir, `${name}.png`) }).catch(() => {});

  function record(id, pass, details) {
    results.checks.push({ id, pass, details });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${JSON.stringify(details)}`);
  }

  // Negative controls run first so their result is in every report.
  record('self-test', selfTest(), { note: 'synthetic frames; see CRITERIA.md' });

  // T1 build
  if (!process.argv.includes('--skip-build')) {
    const b = spawnSync('bash', ['platform/build.sh'], { cwd: ROOT, encoding: 'utf8', timeout: 600000 });
    fs.writeFileSync(path.join(outDir, 'build.log'), `${b.stdout || ''}\n--- stderr ---\n${b.stderr || ''}`);
    const files = ['index.html', 'doom.js', 'doom.wasm', 'doom.data'];
    const missing = files.filter((f) => !fs.existsSync(path.join(DIST, f)));
    const wasmSize = missing.includes('doom.wasm') ? 0 : fs.statSync(path.join(DIST, 'doom.wasm')).size;
    record('T1 build', b.status === 0 && !missing.length && wasmSize > MIN_WASM_BYTES,
      { exit: b.status, missing, wasmSize, minWasmBytes: MIN_WASM_BYTES, log: path.relative(ROOT, path.join(outDir, 'build.log')) });
  } else {
    record('T1 build', fs.existsSync(path.join(DIST, 'doom.wasm')), { skipped: true, note: '--skip-build: only checked dist exists' });
  }

  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    for (const id of ['T2 serve', 'T3 boots', 'T4 pixels', 'T5 input', 'T6 gameplay', 'T7 stability', 'T8 WAD', 'T9 colors', 'T10 idle'])
      record(id, false, { reason: 'dist/index.html missing' });
    return finish(results, outDir);
  }

  const { chromium } = require('playwright');
  const { server, url } = await serve(DIST);
  let browser;
  try {
    const g = await openGame(chromium, url, { headed });
    browser = g.browser; const { page, log } = g;

    // T3 boots (ready wait also covers the T2 window)
    const t0 = Date.now();
    let ready = false;
    try { await page.waitForFunction(() => window.doomReady === true, null, { timeout: 30000 }); ready = true; } catch (_) {}
    const readyMs = Date.now() - t0;
    const firstFrame = ready ? await grab(page) : null;
    await shot(page, 't3-first-frame');
    const frames = ready ? await frameCountDelta(page, 3000) : 0;
    record('T3 boots', ready && frames >= 20, { ready, readyMs, framesIn3s: frames });

    // T2 serve: finish the 10 s observation window
    const remaining = 10000 - (Date.now() - t0);
    if (remaining > 0) await page.waitForTimeout(remaining);
    record('T2 serve', log.wasmType && log.wasmType.startsWith('application/wasm') &&
      !log.consoleErrors.length && !log.pageErrors.length && !log.failed.length && !log.bad.length,
    { wasmType: log.wasmType, consoleErrors: log.consoleErrors.slice(0, 10), pageErrors: log.pageErrors.slice(0, 10),
      failed: log.failed, badResponses: log.bad });

    // T4 pixels
    if (ready) {
      await page.waitForTimeout(6000);
      const later = await grab(page);
      await shot(page, 't4-later-frame');
      const r = frameLooksRendered(later);
      const change = diffFrac(firstFrame, later);
      record('T4 pixels', r.ok && change >= 0.05, { ...r, changeVsFirst: +change.toFixed(3) });
    } else record('T4 pixels', false, { reason: 'not ready' });

    // T5 input
    let level = null, titleFrame = null, idleFrame = null;
    if (ready) {
      await page.click('#canvas').catch(() => {});
      const before = await grab(page);
      const ng = await startNewGame(page);
      level = ng.level;
      await shot(page, 't5-level');
      titleFrame = ng.title;
      // T10 idle: no keys held for 2 s right after spawning -> player must not move.
      await page.waitForTimeout(2000);
      idleFrame = await grab(page);
      await shot(page, 't10-idle');
      const menuDiff = diffFrac(before, ng.menu);
      const levelDiff = diffFrac(ng.menu, ng.level);
      const statusDiff = diffFrac(ng.title, ng.level, REGION_STATUS);
      record('T5 input', menuDiff >= 0.02 && levelDiff >= 0.10 && statusDiff >= 0.05,
        { menuDiff: +menuDiff.toFixed(3), levelDiff: +levelDiff.toFixed(3), statusBarDiff: +statusDiff.toFixed(3) });
    } else record('T5 input', false, { reason: 'not ready' });

    // T9 colors: title logo and ammo digits are red in the DOOM palette.
    if (titleFrame && level) {
      const logo = redBlueBalance(firstFrame, REGION_LOGO), ammo = redBlueBalance(level, REGION_AMMO);
      record('T9 colors', logo.ok && ammo.ok, { logo, ammoDigits: ammo });
    } else record('T9 colors', false, { reason: 'level not reached' });

    // T10 idle: view static with no input (catches runaway input or game clock).
    if (idleFrame) {
      const idle = diffFrac(level, idleFrame, REGION_VIEW);
      record('T10 idle', idle < 0.10, { idleViewDiff: +idle.toFixed(3) });
    } else record('T10 idle', false, { reason: 'level not reached' });

    // T6 gameplay
    if (level) {
      const a = await grab(page);
      await hold(page, 'ArrowUp', 2000);
      const b = await grab(page);
      await hold(page, 'ArrowLeft', 1000);
      const c = await grab(page);
      await page.waitForTimeout(500);
      const beforeFire = await grab(page);
      for (let i = 0; i < 3; i++) await tap(page, 'Control', 500);
      await page.waitForTimeout(500);
      const afterFire = await grab(page);
      await shot(page, 't6-after-fire');
      const walk = diffFrac(a, b), turn = diffFrac(b, c), ammo = diffFrac(beforeFire, afterFire, REGION_AMMO);
      record('T6 gameplay', walk >= 0.05 && turn >= 0.05 && ammo >= 0.01,
        { walkDiff: +walk.toFixed(3), turnDiff: +turn.toFixed(3), ammoRegionDiff: +ammo.toFixed(3) });
    } else record('T6 gameplay', false, { reason: 'level not reached' });

    // T7 stability
    if (ready) {
      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Control', ' ', 'Shift', 'Enter', 'Escape', '1', '2', '3'];
      const errsBefore = log.pageErrors.length;
      let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const end = Date.now() + 60000;
      while (Date.now() < end && !log.crashed) {
        const k = keys[Math.floor(rnd() * keys.length)];
        await page.keyboard.down(k);
        await page.waitForTimeout(50 + Math.floor(rnd() * 400));
        await page.keyboard.up(k);
      }
      await shot(page, 't7-end');
      const frames7 = log.crashed ? 0 : await frameCountDelta(page, 3000).catch(() => 0);
      const newErrs = log.pageErrors.slice(errsBefore);
      record('T7 stability', !log.crashed && !newErrs.length && frames7 >= 20,
        { crashed: log.crashed, pageErrors: newErrs.slice(0, 10), framesIn3sAtEnd: frames7, seed: 12345 });
    } else record('T7 stability', false, { reason: 'not ready' });

    // T8 WAD
    const external = log.requests.filter((u) => !u.startsWith(url) && !u.startsWith('data:') && !u.startsWith('blob:'));
    const wadReqs = log.requests.filter((u) => /\.wad(\?|$)/i.test(u));
    const dataPath = path.join(DIST, 'doom.data');
    const dataSize = fs.existsSync(dataPath) ? fs.statSync(dataPath).size : 0;
    record('T8 WAD', !external.length && !wadReqs.length && dataSize >= WAD_SIZE && !!level,
      { external, wadRequests: wadReqs, dataSize, wadSize: WAD_SIZE, levelReached: !!level });
  } catch (e) {
    record('harness', false, { error: String(e && e.stack || e) });
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.close();
  }
  return finish(results, outDir);
}

function finish(results, outDir) {
  results.finishedAt = new Date().toISOString();
  results.passed = results.checks.every((c) => c.pass);
  const file = path.join(outDir, 'results.json');
  fs.writeFileSync(file, JSON.stringify(results, null, 2));
  const failed = results.checks.filter((c) => !c.pass).map((c) => c.id);
  console.log(`\n${results.passed ? 'ALL PASS' : `FAILED: ${failed.join(', ')}`}`);
  console.log(`commit ${results.git.commit}${results.git.dirty ? ' (dirty)' : ''}; results: ${path.relative(ROOT, file)}`);
  process.exitCode = results.passed ? 0 : 1;
}

module.exports = { ROOT, DIST, arg, gitInfo, serve, grab, diffFrac, tap, hold, startNewGame, openGame, frameLooksRendered };

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
