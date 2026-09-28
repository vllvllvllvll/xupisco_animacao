// QA: abre o drawer via click real e fotografa desk + iphone.
const { spawn } = require('child_process');
const path = require('path');
const REPO = path.resolve(__dirname, '..');
const CHROME = 'C:/Users/Vinicius/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn(process.execPath,
    [path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', '4181', '--strictPort'],
    { cwd: REPO, stdio: 'ignore' });
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch('http://localhost:4181/'); if (r.ok) break; } catch {}
    await sleep(500);
  }
  for (const [nome, size] of [['qa-drawer-desk', '1280,720'], ['qa-drawer-mob', '390,844']]) {
    const dbg = spawn(CHROME, ['--headless', '--disable-gpu', '--enable-unsafe-swiftshader',
      `--remote-debugging-port=${nome === 'qa-drawer-desk' ? 9336 : 9337}`,
      '--no-first-run', '--window-size=' + size, 'about:blank'], { stdio: 'ignore' });
    await sleep(3000);
    const port = nome === 'qa-drawer-desk' ? 9336 : 9337;
    const tabs = await fetch(`http://localhost:${port}/json`).then((r) => r.json());
    const page = tabs.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 1 << 24 });
    await new Promise((r) => (ws.onopen = r));
    let id = 0;
    const send = (m, p = {}) => new Promise((res) => {
      const my = ++id;
      const h = (e) => { const d = JSON.parse(e.data); if (d.id === my) { ws.removeEventListener('message', h); res(d); } };
      ws.addEventListener('message', h);
      ws.send(JSON.stringify({ id: my, method: m, params: p }));
    });
    const expr = async (s) => (await send('Runtime.evaluate', { expression: s, returnByValue: true })).result.result.value;
    await send('Page.navigate', { url: 'http://localhost:4181/' });
    for (let i = 0; i < 40; i++) {
      if (await expr(`document.getElementById('junta').options.length`) === 19) break;
      await sleep(500);
    }
    await sleep(4000);
    await expr(`document.getElementById('btn-hamb').click()`); // abre o drawer
    await sleep(1000);
    const r1 = await expr(`(()=>{const e=document.getElementById('joy-r1');const r=e.getBoundingClientRect();const t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {visivel:r.width>0, topo:t?t.id||t.className:'null'}})()`);
    console.log(nome, 'R1:', JSON.stringify(r1));
    await send('Page.captureScreenshot', { format: 'png' }).then(async (d) => {
      require('fs').writeFileSync(path.join(REPO, nome + '.png'), Buffer.from(d.result.data, 'base64'));
    });
    ws.close(); dbg.kill();
  }
  server.kill();
  process.exit(0);
})().catch((e) => { console.error('QA ERRO', e.message); process.exit(1); });
