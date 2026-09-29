// E2E: percorre os 9 controladores — seleciona (stick DIR/lista), confirma (R1),
// move nos 3 eixos (stick ESQ, L1 cicla) — valida cada passo no DOM + estado.
// Uso: npm run test:e2e (sobe preview proprio na 4180)
const { spawn } = require('child_process');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PORT = 4180;
const CHROME = 'C:/Users/Vinicius/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0;
const ok = (cond, rotulo) => {
  console.log((cond ? '  ok  ' : '  FALHA') + ' ' + rotulo);
  if (!cond) falhas++;
};

(async () => {
  const server = spawn(process.execPath,
    [path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'],
    { cwd: REPO, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) break; } catch {}
    await sleep(500);
  }

  const chrome = spawn(CHROME, ['--headless', '--disable-gpu', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=9335', '--no-first-run', '--no-default-browser-check', 'about:blank'],
    { stdio: 'ignore' });
  await sleep(3000);
  const tabs = await fetch('http://localhost:9335/json').then((r) => r.json());
  const page = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 1 << 24 });
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const send = (method, params = {}) => new Promise((resolve) => {
    const myId = ++id;
    const h = (e) => {
      const m = JSON.parse(e.data);
      if (m.id === myId) { ws.removeEventListener('message', h); resolve(m); }
    };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
  const expr = async (s) => (await send('Runtime.evaluate', { expression: s, returnByValue: true })).result.result.value;
  const errosConsole = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') errosConsole.push(m.params.exceptionDetails.text);
  });
  await send('Runtime.enable');
  const FAKE_SRC = `
    window.__pad = { ax: [0,0,0,0], btn: [false,false,false,false,false,false,false,false] };
    window.__fakePad = function () {
      const p = window.__pad;
      return [{ connected: true, id: 'fake-e2e',
        get axes() { return p.ax.slice(); },
        buttons: [0,1,2,3,4,5,6,7].map((i) => ({ get pressed() { return !!window.__pad.btn[i]; } })),
      }];
    };
    try { Navigator.prototype.getGamepads = window.__fakePad; } catch (e) {}
    try { Object.defineProperty(navigator, 'getGamepads', { value: window.__fakePad, configurable: true }); } catch (e) {}`;
  await send('Page.addScriptToEvaluateOnNewDocument', { source: FAKE_SRC });
  await send('Page.navigate', { url: `http://localhost:${PORT}/` });
  for (let i = 0; i < 60; i++) {
    const n = await expr(`document.querySelectorAll('#controladores-lista button').length`);
    if (n === 9) break;
    await sleep(1000);
  }
  await expr(FAKE_SRC);
  await sleep(3000);

  const sel = () => expr(`window.__xup.estado.controlador`);
  const modo = () => expr(`document.getElementById('gpad-modo').textContent`);
  const letraEixo = () => expr(`document.getElementById('eixo-ind').textContent`);
  const pos = (c) => expr(`('${c}' === 'ctrl_cintura' ? window.__xup.bones.cintura : window.__xup.controles['${c}']).position.toArray()`);
  const setPad = (patch) => expr(`Object.assign(window.__pad, ${JSON.stringify(patch)})`);
  const botoes = (l1, r1) => setPad({ btn: [false, false, false, false, l1, r1, false, false] });
  const pressR1 = async () => { await botoes(false, true); await sleep(200); await botoes(false, false); await sleep(300); };
  const pressL1 = async () => { await botoes(true, false); await sleep(200); await botoes(false, false); await sleep(300); };
  const passoNav = async () => { await setPad({ ax: [0, 0, 0, 1] }); await sleep(150); await setPad({ ax: [0, 0, 0, 0] }); await sleep(400); };
  const empurraEsq = async () => { // stick ESQ: so horizontal, move o eixo ativo
    await setPad({ ax: [1, 0, 0, 0] });
    await sleep(1000);
    await setPad({ ax: [0, 0, 0, 0] }); await sleep(250);
  };

  const LISTA = await expr(`window.__xup.CONTROLADORES`);
  ok(Array.isArray(LISTA) && LISTA.length === 9, `9 controladores expostos (achou ${LISTA && LISTA.length})`);
  ok(await sel() === 'alvo_mao_D', 'inicio em alvo_mao_D');
  ok((await modo()).includes('selecao'), 'inicio em modo selecao');

  // click no drawer seleciona direto
  await expr(`[...document.querySelectorAll('#controladores-lista button')].find(b=>b.textContent==='polo_joelho_D').click()`);
  await sleep(300);
  ok(await sel() === 'polo_joelho_D', 'click no drawer seleciona polo_joelho_D');

  const idx = async () => LISTA.indexOf(await sel());
  for (let k = 0; k < 9; k++) {
    const esperado = LISTA[((await idx()) + 1) % 9];
    await passoNav();
    const atual = await sel();
    ok(atual === esperado, `[${k + 1}/9] seleciona ${atual}`);
    if (atual !== esperado) { console.log('    esperado: ' + esperado); continue; }
    await pressR1();
    ok((await modo()).includes('mover'), `  R1 confirma ${atual} → mover`);
    for (const [eixo] of [['x'], ['y'], ['z']]) {
      const antes = (await pos(atual))[['x', 'y', 'z'].indexOf(eixo)];
      await empurraEsq();
      const depois = (await pos(atual))[['x', 'y', 'z'].indexOf(eixo)];
      ok(Math.abs(depois - antes) > 0.25, `  move ${atual}.${eixo}: ${antes.toFixed(2)} → ${depois.toFixed(2)}`);
      await pressL1();
    }
    ok(await letraEixo() === 'X', '  L1 ciclou x→y→z→X');
    await pressR1();
    ok((await modo()).includes('selecao'), '  R1 volta p/ selecao');
  }
  ok(await sel() === 'polo_joelho_D', 'deu a volta e voltou em polo_joelho_D');
  ok(errosConsole.length === 0, `console sem excecoes (${errosConsole.length})`);
  if (errosConsole.length) console.log(errosConsole.slice(0, 3));

  console.log(falhas === 0 ? '\nE2E PASSOU' : `\nE2E FALHOU (${falhas})`);
  ws.close(); chrome.kill(); server.kill();
  process.exit(falhas === 0 ? 0 : 1);
})().catch((e) => { console.error('E2E ERRO', e.message); process.exit(2); });
