#!/usr/bin/env node
// Scripted play session: new game, walk, turn, fire, open menu. Saves numbered
// screenshots to artifacts/runs/<run-id>/screenshots/. Usage:
//   node tests/play.js [--run-id ID] [--headed]     (or RUN_ID env var)
// Requires an existing dist/ build (run platform/build.sh or tests/run_all.js first).
'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, DIST, arg, gitInfo, serve, tap, hold, openGame } = require('./run_all');

async function main() {
  const runId = arg('--run-id', process.env.RUN_ID || `play-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const outDir = path.join(ROOT, 'artifacts', 'runs', runId, 'screenshots');
  fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/index.html missing; build first'); process.exit(1);
  }

  const { chromium } = require('playwright');
  const { server, url } = await serve(DIST);
  const { browser, page, log } = await openGame(chromium, url, { headed: process.argv.includes('--headed') });
  const steps = [];
  let n = 0;
  const snap = async (label) => {
    const file = path.join(outDir, `${String(++n).padStart(2, '0')}-${label}.png`);
    await page.locator('#canvas').screenshot({ path: file });
    const frames = await page.evaluate(() => window.doomFrameCount | 0).catch(() => null);
    steps.push({ step: n, label, file: path.relative(ROOT, file), frameCount: frames, t: new Date().toISOString() });
    console.log(`saved ${path.relative(ROOT, file)} (frames=${frames})`);
  };

  let ok = true;
  try {
    await page.waitForFunction(() => window.doomReady === true, null, { timeout: 30000 });
    await page.click('#canvas').catch(() => {});
    await snap('title');
    await tap(page, 'Escape', 800); await snap('menu');
    await tap(page, 'Enter', 600); await snap('episode-select');
    await tap(page, 'Enter', 600); await snap('skill-select');
    await tap(page, 'Enter', 3000); await snap('level-start');
    await hold(page, 'ArrowUp', 2000); await snap('walked-forward');
    await hold(page, 'ArrowLeft', 800); await snap('turned-left');
    await hold(page, 'ArrowRight', 1600); await snap('turned-right');
    await tap(page, 'Control', 150); await snap('firing');
    await page.waitForTimeout(600); await snap('after-fire');
    await page.keyboard.down('Shift'); await hold(page, 'ArrowUp', 1500); await page.keyboard.up('Shift');
    await snap('ran-forward');
    await tap(page, ' ', 800); await snap('used');
    await tap(page, 'Escape', 800); await snap('ingame-menu');
    await tap(page, 'Escape', 800); await snap('menu-closed');
  } catch (e) {
    ok = false;
    console.error('play failed:', e.message);
    await snap('failure').catch(() => {});
  } finally {
    const summary = { runId, git: gitInfo(), ok, steps, pageErrors: log.pageErrors, consoleErrors: log.consoleErrors };
    fs.writeFileSync(path.join(outDir, 'play.json'), JSON.stringify(summary, null, 2));
    await browser.close().catch(() => {});
    server.close();
  }
  process.exitCode = ok && !log.pageErrors.length ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
