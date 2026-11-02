// Drives Image Tool (Electron, from source) with Playwright and records monitor 2 with ffmpeg.
// Usage: DEMO_USERDATA=<dir> node record-demo.js <out.mkv> <timeline.json>
// Every step asserts its result; any failure stops the run (nothing is hidden by editing).
const { _electron: electron } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const DEMO = 'C:\\demo', SRC = path.join(DEMO, 'forest.jpg');
const OUT = process.argv[2], TL = process.argv[3];
const USERDATA = process.env.DEMO_USERDATA;
const dur = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'audio', 'durations.json')));
const MON = { x: 1920, y: 0, w: 1920, h: 1080 };
const ZOOM = 1.5;
const LEAD = 0.25, TAIL = 0.8;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const step = (scene, name, ok, extra = '') => {
  log.push({ scene, name, pass: !!ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${scene} ${name} ${extra}`);
  if (!ok) throw new Error(`Step failed: ${scene} ${name}`);
};
const explorerOpen = () => execFileSync('powershell', ['-NoProfile', '-Command',
  "(New-Object -ComObject Shell.Application).Windows() | Where-Object { $_.LocationURL -like '*/demo' } | Measure-Object | ForEach-Object Count"]).toString().trim() !== '0';

(async () => {
  // remove only outputs of earlier demo runs; the source copy is kept
  for (const f of fs.readdirSync(DEMO)) if (f.startsWith('forest_')) fs.unlinkSync(path.join(DEMO, f));
  const origSize = fs.statSync(SRC).size;
  execFileSync('powershell', ['-NoProfile', '-File', path.join(__dirname, 'place-explorer.ps1'), String(MON.x + 120), '80', '1680', '900']);

  const app = await electron.launch({ executablePath: path.join(ROOT, 'app', 'node_modules', 'electron', 'dist', 'electron.exe'), args: [path.join(ROOT, 'app'), `--user-data-dir=${USERDATA}`] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  // Answer the native open dialog with the demo copy (Playwright cannot drive native dialogs).
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, SRC);
  await app.evaluate(({ BrowserWindow }, a) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.setBounds({ x: a.m.x, y: a.m.y, width: a.m.w, height: a.m.h });
    w.setFullScreen(true); w.webContents.setZoomFactor(a.z); w.focus();
  }, { m: MON, z: ZOOM });
  await sleep(1500);
  // visual cursor so viewers can follow clicks (recording overlay only; app code is unchanged)
  await page.evaluate(() => {
    const c = document.createElement('div'); c.id = '__cur';
    Object.assign(c.style, { position: 'fixed', left: '60px', top: '60px', width: '26px', height: '26px', borderRadius: '50%',
      border: '3px solid #ffd54a', background: 'rgba(255,213,74,.25)', zIndex: 99999, pointerEvents: 'none',
      transition: 'left .7s ease, top .7s ease, transform .15s' });
    document.body.appendChild(c);
  });
  async function point(sel) {
    const b = await page.locator(sel).boundingBox();
    await page.evaluate(([x, y]) => { const c = document.getElementById('__cur'); c.style.left = (x - 13) + 'px'; c.style.top = (y - 13) + 'px'; },
      [b.x + b.width / 2, b.y + b.height / 2]);
    await sleep(800);
    await page.evaluate(() => { const c = document.getElementById('__cur'); c.style.transform = 'scale(.6)'; setTimeout(() => (c.style.transform = ''), 160); });
  }

  const scrollTo = (top) => page.evaluate((t) => window.scrollTo({ top: t, behavior: 'smooth' }), top);

  // ---- start recording
  const ff = spawn('ffmpeg', ['-y', '-f', 'gdigrab', '-framerate', '30', '-draw_mouse', '0', '-offset_x', String(MON.x), '-offset_y', String(MON.y),
    '-video_size', `${MON.w}x${MON.h}`, '-i', 'desktop', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', OUT]);
  await new Promise((res) => { ff.stderr.on('data', (d) => { if (/frame=/.test(String(d))) res(); }); });
  const t0 = Date.now();
  const now = () => (Date.now() - t0) / 1000;
  const timeline = {};
  let sceneStart = 0, sceneLen = 0, sceneId = '';
  const begin = (id) => { sceneId = id; sceneStart = now(); sceneLen = dur[id] + LEAD + TAIL; timeline[id] = { start: sceneStart, audioAt: sceneStart + LEAD, len: sceneLen }; };
  const at = async (t) => { const w = sceneStart + t - now(); if (w > 0) await sleep(w * 1000); };
  const end = async () => { const over = now() - (sceneStart + sceneLen); step(sceneId, 'scene fits narration', over < 0.05, `overrun=${over.toFixed(2)}s`); await at(sceneLen); };

  try {
    begin('s01');
    step('s01', 'drop area visible', await page.locator('#drop').isVisible());
    step('s01', 'image section hidden', await page.locator('#imageSection').isHidden());
    await end();

    begin('s02');
    await at(1.0); await point('#pickBtn'); await page.click('#pickBtn');
    await page.waitForSelector('#imageSection', { state: 'visible', timeout: 15000 });
    const info = await page.textContent('#imageInfo');
    step('s02', 'details shown', (await page.textContent('#fileName')) === 'forest.jpg' && /1920×1080/.test(info) && /JPEG/.test(info), info);
    await end();

    begin('s03');
    await at(1.0); await point('#resizeMode'); await page.selectOption('#resizeMode', 'width');
    step('s03', 'resize value box visible', await page.locator('#resizeValueBox').isVisible());
    await at(3.4); await point('#resizeValue'); await page.fill('#resizeValue', '');
    await page.type('#resizeValue', '800', { delay: 250 });
    step('s03', 'width = 800', (await page.inputValue('#resizeValue')) === '800');
    await at(6.0); await point('#format'); await page.selectOption('#format', 'webp');
    step('s03', 'type = webp', (await page.inputValue('#format')) === 'webp');
    await at(7.6); await point('#runBtn'); await page.click('#runBtn');
    await page.waitForSelector('#result', { state: 'visible', timeout: 60000 });
    const t3 = await page.textContent('#resultText');
    const out3 = path.join(DEMO, 'forest_resized_800x450_converted.webp');
    step('s03', 'result shown + file exists', t3.includes('forest_resized_800x450_converted.webp') && fs.existsSync(out3), t3);
    await page.waitForFunction(() => { const i = document.getElementById('resultImg'); return i.complete && i.naturalWidth === 800; }, null, { timeout: 10000 });
    step('s03', 'preview loaded 800 wide', true);
    await at(10.2); await scrollTo(99999); await at(13.0);
    await end();

    begin('s04');
    await at(0.3); await scrollTo(0);
    await at(2.4); await point('#resizeMode'); await page.selectOption('#resizeMode', '');
    await at(3.4); await point('#format'); await page.selectOption('#format', '');
    step('s04', 'compress enabled', await page.locator('#compress').isEnabled());
    await at(4.6); await point('#compress'); await page.check('#compress');
    step('s04', 'quality box visible', await page.locator('#qualityBox').isVisible());
    await at(6.0); await point('#quality'); await page.fill('#quality', '60');
    await at(7.6); await point('#runBtn'); await page.click('#runBtn');
    await page.waitForFunction(() => /forest_compressed/.test(document.getElementById('resultText').textContent), null, { timeout: 60000 });
    const t4 = await page.textContent('#resultText');
    const out4 = path.join(DEMO, 'forest_compressed.jpg');
    step('s04', 'result shown + file exists + smaller', fs.existsSync(out4) && fs.statSync(out4).size < origSize, t4);
    await at(10.2); await scrollTo(99999);
    await end();

    begin('s05');
    await at(1.0); await point('#showBtn'); await page.click('#showBtn');
    await sleep(2000);
    step('s05', 'Explorer folder window open', explorerOpen());
    timeline.sizes = { original: origSize, resized: fs.statSync(out3).size, compressed: fs.statSync(out4).size };
    await end();
    timeline.recordingEnd = now();
  } finally {
    ff.stdin.write('q'); await new Promise((r) => ff.on('close', r));
    fs.writeFileSync(TL, JSON.stringify({ timeline, log }, null, 1));
  }
  await app.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
