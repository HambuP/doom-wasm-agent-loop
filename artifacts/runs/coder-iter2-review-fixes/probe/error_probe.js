// Scratch probe (coder, not a protected check): load dist/, capture page error stacks.
const path = require('path');
const { serve } = require(path.resolve(__dirname, '../../../../tests/run_all'));
(async () => {
  const { chromium } = require('playwright');
  const { server, url } = await serve(require(path.resolve(__dirname, '../../../../tests/run_all')).DIST);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.stack || String(e)));
  page.on('console', m => { if (m.type() !== 'log') console.log('console.' + m.type() + ': ' + m.text()); });
  await page.goto(url);
  await page.waitForTimeout(Number(process.env.WAIT || 8000));
  console.log('frames', await page.evaluate(() => window.doomFrameCount), 'reentries', await page.evaluate(() => window.doomTickReentries));
  console.log('errors', errs.length);
  if (errs.length) console.log(errs[0]);
  await browser.close(); server.close();
})();
