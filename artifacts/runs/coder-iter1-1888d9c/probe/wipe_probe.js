const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dist = path.resolve(process.argv[2]);
const types = { '.html':'text/html', '.js':'text/javascript', '.wasm':'application/wasm', '.data':'application/octet-stream' };
const srv = http.createServer((q, r) => { const f = path.join(dist, q.url === '/' ? 'index.html' : q.url);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'Content-Type': types[path.extname(f)] || 'application/octet-stream'}); r.end(d); }); });
srv.listen(0, '127.0.0.1', async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('console', m => console.log('console:', m.type(), m.text()));
  await p.goto(`http://127.0.0.1:${srv.address().port}/`);
  await p.waitForFunction(() => window.doomReady === true);
  // Sample frame counter every 20 ms via rAF timestamps for 12 s (covers title->demo wipe).
  const r = await p.evaluate(() => new Promise(res => { const s = []; const t0 = performance.now();
    (function f() { s.push([performance.now() - t0, window.doomFrameCount]); if (performance.now() - t0 < 12000) requestAnimationFrame(f); else res(s); })(); }));
  let maxGap = 0; for (let i = 1; i < r.length; i++) maxGap = Math.max(maxGap, r[i][0] - r[i-1][0]);
  // Enter menu and start a game to trigger a wipe on keypress too
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  for (const k of ['Enter','Enter','Enter']) { await p.keyboard.press(k); await p.waitForTimeout(300); }
  const shots = []; for (let i = 0; i < 6; i++) { await p.screenshot({ path: `build/probe/wipe-${i}.png` }); await p.waitForTimeout(100); }
  console.log(JSON.stringify({ samples: r.length, maxRafGapMs: Math.round(maxGap), frames: r[r.length-1][1] - r[0][1], title: await p.title() }));
  await b.close(); srv.close();
});
