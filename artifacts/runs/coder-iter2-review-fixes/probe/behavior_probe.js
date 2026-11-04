// Scratch probe (coder, not a protected check). Usage: node behavior_probe.js <dir-to-serve>
// Exercises: wipe + gameplay (Asyncify paths), key scoping to canvas focus,
// browser shortcuts left alone, and Quit Game stopping the main loop.
const path = require('path');
const T = require(path.resolve(__dirname, '../../../../tests/run_all'));
(async () => {
  const { chromium } = require('playwright');
  const { server, url } = await T.serve(path.resolve(process.argv[2] || T.DIST));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [], warns = [];
  page.on('pageerror', e => errs.push(e.stack || String(e)));
  page.on('console', m => { if (m.type() === 'error' || /Asyncify|re-entered|assert/i.test(m.text())) warns.push(m.type() + ': ' + m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.doomReady === true, null, { timeout: 30000 });
  // Record defaultPrevented for every keydown, observed after the page's handlers.
  await page.evaluate(() => {
    window.__kd = [];
    window.addEventListener('keydown', e => window.__kd.push([e.code, e.ctrlKey, e.metaKey, e.defaultPrevented]));
  });
  const out = {};
  const frames = () => page.evaluate(() => window.doomFrameCount);
  const shot = () => T.grab(page);

  // 1. Unfocused canvas: keys must not reach the game.
  await page.evaluate(() => document.getElementById('canvas').blur());
  let a = await shot();
  await T.tap(page, 'Escape', 150); await page.waitForTimeout(600);
  out.unfocusedEscDiff = T.diffFrac(a, await shot());
  out.unfocusedEscPrevented = (await page.evaluate(() => window.__kd.slice(-1)[0]))[3];

  // 2. Focused: menu opens; new game (wipe), walk while firing.
  await page.click('#canvas');
  a = await shot();
  await T.tap(page, 'Escape', 150); await page.waitForTimeout(600);
  out.focusedEscDiff = T.diffFrac(a, await shot());
  for (const k of ['Enter', 'Enter', 'Enter']) { await T.tap(page, k, 150); await page.waitForTimeout(400); }
  await page.waitForTimeout(2500);
  const f0 = await frames();
  await page.keyboard.down('Control'); await T.hold(page, 'ArrowUp', 1000); await page.keyboard.up('Control');
  out.framesDuringCtrlWalk = (await frames()) - f0;
  const kd = await page.evaluate(() => window.__kd);
  out.ctrlArrowUpPrevented = kd.filter(k => k[0] === 'ArrowUp' && k[1]).map(k => k[3]);

  // 3. Browser shortcuts while focused: not prevented.
  await page.keyboard.down('Control'); await page.keyboard.press('KeyL'); await page.keyboard.up('Control');
  await page.keyboard.press('F12');
  const kd2 = await page.evaluate(() => window.__kd.slice(-4));
  out.ctrlL_and_F12 = kd2.filter(k => k[0] === 'KeyL' || k[0] === 'F12');

  // 4. Quit Game: Esc, Up (wraps to Quit Game), Enter, y.
  for (const k of ['Escape', 'ArrowUp', 'Enter']) { await T.tap(page, k, 150); await page.waitForTimeout(400); }
  await T.tap(page, 'y', 150);
  await page.waitForTimeout(1500);
  out.exited = await page.evaluate(() => window.doomExited);
  out.status = await page.evaluate(() => document.getElementById('status').textContent);
  const q0 = await frames(); await page.waitForTimeout(2000);
  out.framesAfterQuit2s = (await frames()) - q0;
  out.tickReentries = await page.evaluate(() => window.doomTickReentries);
  out.pageErrors = errs; out.consoleFlags = warns;
  console.log(JSON.stringify(out, null, 2));
  await browser.close(); server.close();
})();
