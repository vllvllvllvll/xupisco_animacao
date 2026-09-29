import * as THREE from 'three';
import { initPalco } from './cena/palco.js';
import { calcularViewports } from './cena/viewports.js';
import { buildPersonagem } from './rig/personagem.js';
import { listarBones, CONTROLADORES_MOVEIS, COR_EIXO, LIMITES_CONTROLE, PISO_PES } from './rig/hierarquia.js';
import { resolverIK2Ossos } from './rig/ik.js';
import { fixar, proximoEixo, navegarLista, bordaSubida, moverNoEixo, fixarFaixa } from './controle/joystick.js';
import { initJoystickVirtual } from './controle/virtual.js';
import { lerGamepad } from './controle/gamepad.js';
import { extrairPose, aplicarPose, amostrar, quadroAtual } from './anim/timeline.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { criarRetarget } from './rig/retarget.js';
import { verificarENormalizarPesos } from './rig/pesos.js';

const $ = (id) => document.getElementById(id);
const canvas = $('gl');

const palco = initPalco(canvas);
const { grupo, bones, meshes, controles } = buildPersonagem();
palco.scene.add(grupo);
palco.scene.add(buildHelper());
function buildHelper() {
  const h = new THREE.SkeletonHelper(bones.cintura);
  h.material.color.set(0xff383c);
  return h;
}

// ---------- Xbot (humanoide rigado do repo three.js) + fallback primitivas ----------
let xbotRaiz = null, retarget = null, usarXbot = false;

function setupXbot(gltf) {
  xbotRaiz = gltf.scene;
  palco.scene.add(xbotRaiz);
  // Auto-escala: iguala a altura do Xbot a do nosso rig (arquivo ja traz sua escala).
  xbotRaiz.updateMatrixWorld(true);
  const tamX = new THREE.Box3().setFromObject(xbotRaiz).getSize(new THREE.Vector3());
  const tamN = new THREE.Box3().setFromObject(grupo).getSize(new THREE.Vector3());
  if (tamX.y > 1e-6 && tamN.y > 1e-6) xbotRaiz.scale.setScalar(tamN.y / tamX.y);
  // Pesos: verifica e normaliza (orfaos sao reportados, sem inventar deformacao).
  let total = 0, orfaos = 0, norm = 0;
  xbotRaiz.traverse((o) => {
    if (o.isSkinnedMesh) {
      const r = verificarENormalizarPesos({
        count: o.geometry.attributes.position.count,
        skinIndex: o.geometry.attributes.skinIndex,
        skinWeight: o.geometry.attributes.skinWeight,
      });
      total += r.total; orfaos += r.orfaos; norm += r.normalizados;
    }
  });
  // Captura o repouso com nosso rig zerado (independe do momento do load).
  const salvo = {};
  for (const n of listarBones()) {
    salvo[n] = { p: bones[n].position.clone(), q: bones[n].quaternion.clone() };
    bones[n].quaternion.identity();
  }
  grupo.updateMatrixWorld(true);
  xbotRaiz.updateMatrixWorld(true);
  retarget = criarRetarget(bones, xbotRaiz);
  for (const n of Object.keys(salvo)) {
    bones[n].position.copy(salvo[n].p);
    bones[n].quaternion.copy(salvo[n].q);
  }
  grupo.updateMatrixWorld(true);
  usarXbot = true;
  aplicarModelo();
  $('msg').textContent = `Xbot ok · ${total} verts · ${orfaos} orfaos · ${norm} normalizados.`;
}

function aplicarModelo() {
  const comXbot = usarXbot && xbotRaiz;
  for (const m of Object.values(meshes)) m.visible = !comXbot;
  if (xbotRaiz) xbotRaiz.visible = !!comXbot;
  $('btn-modelo').textContent = comXbot ? 'modelo: xbot' : 'modelo: primitivas';
}

new GLTFLoader().load('/modelo-xbot.glb', setupXbot, undefined, () => {
  $('msg').textContent = 'Modelo Xbot indisponivel — primitivas ativas.';
});

$('btn-modelo').addEventListener('click', () => {
  if (!xbotRaiz) { $('msg').textContent = 'Xbot ainda carregando ou indisponivel.'; return; }
  usarXbot = !usarXbot;
  aplicarModelo();
});

// ---------- Estado ----------
const estado = {
  controlador: 'alvo_mao_D', // o usuario so toca controladores, nunca bones
  alvo: 'alvo_mao_D',
  ik: { braco_E: true, braco_D: true, perna_E: true, perna_D: true },
  animar: true,
  velocidade: 1.0,
  joy: { x: 0, y: 0, intensidade: 0 },
  joyR: { x: 0, y: 0, intensidade: 0 },
  tempo: 0,
  modo: 'selecao', // gamepad: 'selecao' (R1 confirma) | 'mover' (R1 volta)
  eixo: 'x', // L1 cicla x → y → z
  navCd: 0,
};
const prevBotoes = { l1: false, r1: false };

// Objeto que o controlador selecionado move (cintura = o bone raiz; resto = alvo/polo).
const resolverControlador = (nome) => (nome === 'ctrl_cintura' ? bones.cintura : controles[nome]);
// Visual que pulsa para indicar a selecao (nunca escala bone).
const resolverVisual = (nome) => controles[nome];

// Linha do eixo ativo na cor Blender (aparece ao mover o controlador).
const linhaEixo = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.6, COR_EIXO.x, 0.12, 0.06);
linhaEixo.visible = false;
palco.scene.add(linhaEixo);
const _posBone = new THREE.Vector3();
const _dirEixo = new THREE.Vector3();

const CHAINS = [
  { nome: 'braco_E', raiz: 'ombro_E', meio: 'braco_E', efetor: 'mao_E', alvo: 'alvo_mao_E' },
  { nome: 'braco_D', raiz: 'ombro_D', meio: 'braco_D', efetor: 'mao_D', alvo: 'alvo_mao_D' },
  { nome: 'perna_E', raiz: 'coxa_E', meio: 'perna_E', efetor: 'pe_E', alvo: 'alvo_pe_E' },
  { nome: 'perna_D', raiz: 'coxa_D', meio: 'perna_D', efetor: 'pe_D', alvo: 'alvo_pe_D' },
];
const POLO_DE = { braco_E: 'polo_cotovelo_E', braco_D: 'polo_cotovelo_D', perna_E: 'polo_joelho_E', perna_D: 'polo_joelho_D' };

// Comprimentos em repouso (medidos uma vez).
grupo.updateMatrixWorld(true);
const COMP = {};
for (const c of CHAINS) {
  const r = bones[c.raiz].getWorldPosition(new THREE.Vector3());
  const m = bones[c.meio].getWorldPosition(new THREE.Vector3());
  const e = bones[c.efetor].getWorldPosition(new THREE.Vector3());
  COMP[c.nome] = { a: r.distanceTo(m), b: m.distanceTo(e) };
}
const BASE_ALVOS = {};
for (const c of CHAINS) BASE_ALVOS[c.alvo] = controles[c.alvo].position.clone();
const BASE_CINTURA_Y = bones.cintura.position.y;

// ---------- IK: aponta osso (-Y local) para direcao mundo ----------
const NEG_Y = new THREE.Vector3(0, -1, 0);
const _qp = new THREE.Quaternion();
const _qw = new THREE.Quaternion();
const _dir = new THREE.Vector3();

function apontarOsso(bone, deMundo, paraMundo) {
  _dir.subVectors(paraMundo, deMundo);
  if (_dir.lengthSq() < 1e-10) return;
  _dir.normalize();
  _qw.setFromUnitVectors(NEG_Y, _dir);
  bone.parent.getWorldQuaternion(_qp).invert();
  bone.quaternion.copy(_qp.multiply(_qw));
}

const _R = new THREE.Vector3();
const _T = new THREE.Vector3();
const _P = new THREE.Vector3();
const _M = new THREE.Vector3();

function aplicarIK(nome) {
  const c = CHAINS.find((k) => k.nome === nome);
  const raiz = bones[c.raiz], meio = bones[c.meio];
  raiz.getWorldPosition(_R);
  controles[c.alvo].getWorldPosition(_T);
  controles[POLO_DE[nome]].getWorldPosition(_P);
  const sol = resolverIK2Ossos({
    origem: { x: _R.x, y: _R.y, z: _R.z },
    compA: COMP[nome].a, compB: COMP[nome].b,
    alvo: { x: _T.x, y: _T.y, z: _T.z },
    polo: { x: _P.x, y: _P.y, z: _P.z },
  });
  _M.set(sol.posMeio.x, sol.posMeio.y, sol.posMeio.z);
  apontarOsso(raiz, _R, _M);
  grupo.updateMatrixWorld(true);
  meio.getWorldPosition(_M);
  _T.set(sol.alvoLimitado.x, sol.alvoLimitado.y, sol.alvoLimitado.z);
  apontarOsso(meio, _M, _T);
}

// ---------- UI (so controladores; bones ficam escondidos) ----------
const selAlvo = $('alvo');
for (const n of Object.keys(controles)) {
  if (!n.startsWith('alvo_')) continue;
  const o = document.createElement('option');
  o.value = n; o.textContent = n;
  if (n === estado.alvo) o.selected = true;
  selAlvo.appendChild(o);
}
selAlvo.addEventListener('change', () => { estado.alvo = selAlvo.value; lerSlidersDoAlvo(); });

// Lista de controladores no drawer.
const botoesControles = {};
for (const n of CONTROLADORES_MOVEIS) {
  const b = document.createElement('button');
  b.textContent = n;
  b.addEventListener('click', () => selecionarControlador(n));
  $('controladores-lista').appendChild(b);
  botoesControles[n] = b;
}
function selecionarControlador(nome) {
  estado.controlador = nome;
  for (const [n, b] of Object.entries(botoesControles)) b.classList.toggle('atual', n === nome);
}
function lerSlidersDoAlvo() {
  const a = controles[estado.alvo];
  $('tx').value = a.position.x.toFixed(2);
  $('ty').value = a.position.y.toFixed(2);
  $('tz').value = a.position.z.toFixed(2);
  mostrarValores();
}
for (const id of ['tx', 'ty', 'tz']) {
  $(id).addEventListener('input', () => {
    const a = controles[estado.alvo];
    a.position.set(parseFloat($('tx').value), parseFloat($('ty').value), parseFloat($('tz').value));
    mostrarValores();
  });
}
function mostrarValores() {
  $('val-alvo').textContent = `${parseFloat($('tx').value).toFixed(2)} ${parseFloat($('ty').value).toFixed(2)} ${parseFloat($('tz').value).toFixed(2)}`;
}

for (const c of CHAINS) {
  $(`ik-${c.nome}`).addEventListener('change', (e) => { estado.ik[c.nome] = e.target.checked; });
}
$('animar').addEventListener('change', (e) => { estado.animar = e.target.checked; });
$('velocidade').addEventListener('input', (e) => { estado.velocidade = parseFloat(e.target.value); });

$('pose-repouso').addEventListener('click', poseRepouso);
$('pose-t').addEventListener('click', poseT);
$('pose-sentar').addEventListener('click', poseSentar);
$('pose-salvar').addEventListener('click', salvarPose);
$('pose-ler').addEventListener('click', lerPose);
$('eixo-ind').addEventListener('click', ciclarEixo);
$('btn-hamb').addEventListener('click', () => $('painel').classList.toggle('fechado'));

function poseRepouso() {
  for (const n of listarBones()) bones[n].rotation.set(0, 0, 0);
  bones.cintura.position.set(0, BASE_CINTURA_Y, 0);
  for (const c of CHAINS) controles[c.alvo].position.copy(BASE_ALVOS[c.alvo]);
  controles.polo_cotovelo_E.position.set(-0.55, 1.35, -0.35);
  controles.polo_cotovelo_D.position.set(0.55, 1.35, -0.35);
  controles.polo_joelho_E.position.set(-0.12, 0.6, 0.5);
  controles.polo_joelho_D.position.set(0.12, 0.6, 0.5);
  lerSlidersDoAlvo();
}
function poseT() {
  poseRepouso();
  controles.alvo_mao_E.position.set(-1.15, 1.55, 0);
  controles.alvo_mao_D.position.set(1.15, 1.55, 0);
  lerSlidersDoAlvo();
}
function poseSentar() {
  poseRepouso();
  bones.cintura.position.y = 0.62;
  controles.alvo_pe_E.position.set(-0.13, 0.12, 0.42);
  controles.alvo_pe_D.position.set(0.13, 0.12, 0.42);
  bones.pescoco.rotation.x = -0.15;
  lerSlidersDoAlvo();
}
function salvarPose() {
  const pose = {};
  for (const n of listarBones()) {
    const b = bones[n];
    pose[n] = { r: [b.rotation.x, b.rotation.y, b.rotation.z], p: b === bones.cintura ? [b.position.x, b.position.y, b.position.z] : undefined };
  }
  localStorage.setItem('xupisco_pose', JSON.stringify(pose));
  $('msg').textContent = 'Pose salva no navegador.';
}
function lerPose() {
  try {
    const pose = JSON.parse(localStorage.getItem('xupisco_pose'));
    if (!pose) { $('msg').textContent = 'Nenhuma pose salva.'; return; }
    for (const n of Object.keys(pose)) {
      if (!bones[n]) continue;
      bones[n].rotation.set(...pose[n].r);
      if (n === 'cintura' && pose[n].p) bones.cintura.position.set(...pose[n].p);
    }
    $('msg').textContent = 'Pose restaurada.';
  } catch { $('msg').textContent = 'Falha ao ler pose.'; }
}

// Botoes na tela espelham L1/R1 do gamepad + fullscreen.
function ciclarEixo() { estado.eixo = proximoEixo(estado.eixo); }
function alternarModo() { estado.modo = estado.modo === 'selecao' ? 'mover' : 'selecao'; }
$('joy-l1').addEventListener('click', ciclarEixo);
$('joy-r1').addEventListener('click', alternarModo);
$('btn-full').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
});

// ---------- Timeline: keys + play + fps + onion skin ----------
const tl = { keys: [], playhead: 0, tocando: false, fps: 24, onion: false };

function fantasma(cor) {
  const g = grupo.clone(true);
  g.traverse((o) => {
    if (o.isMesh) { o.material = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.16, depthWrite: false }); o.castShadow = false; }
  });
  g.visible = false;
  palco.scene.add(g);
  const mapa = {};
  g.traverse((o) => { if (o.isBone) mapa[o.name] = o; });
  return { g, mapa };
}
const fantasmaAnt = fantasma(0xff383c);
const fantasmaProx = fantasma(0x8f1414);

function desenharKeys() {
  const box = $('tl-keys');
  box.innerHTML = '';
  tl.keys.forEach((k, i) => {
    const b = document.createElement('button');
    b.textContent = `K${i + 1} ${k.t.toFixed(1)}s`;
    b.addEventListener('click', () => { tl.playhead = k.t; aplicarPose(bones, k.pose); lerSlidersDoAlvo(); });
    box.appendChild(b);
  });
  $('tl-frame').textContent = `q${quadroAtual(tl.playhead, tl.fps)} · ${tl.playhead.toFixed(2)}s · ${tl.keys.length} keys`;
}

$('tl-rec').addEventListener('click', () => {
  tl.keys.push({ t: tl.playhead, pose: extrairPose(bones) });
  tl.keys.sort((a, b) => a.t - b.t);
  desenharKeys();
  $('msg').textContent = `Key salva em ${tl.playhead.toFixed(2)}s.`;
});
$('tl-play').addEventListener('click', () => {
  tl.tocando = !tl.tocando;
  $('tl-play').textContent = tl.tocando ? '⏸' : '▶';
  $('tl-play').classList.toggle('tocando', tl.tocando);
  if (tl.tocando && tl.keys.length > 1 && estado.animar) {
    estado.animar = false; // marcha brigaria com as keys
    $('animar').checked = false;
    $('msg').textContent = 'Marcha pausada p/ tocar a timeline.';
  }
  if (tl.tocando && tl.keys.length < 2) { $('msg').textContent = 'Grave 2+ keys primeiro.'; tl.tocando = false; $('tl-play').textContent = '▶'; $('tl-play').classList.remove('tocando'); }
});
$('tl-fps').addEventListener('change', (e) => { tl.fps = parseInt(e.target.value, 10); desenharKeys(); });
$('tl-onion').addEventListener('change', (e) => {
  tl.onion = e.target.checked;
  if (!tl.onion) { fantasmaAnt.g.visible = false; fantasmaProx.g.visible = false; }
});
$('tl-limpar').addEventListener('click', () => {
  tl.keys = []; tl.playhead = 0; tl.tocando = false;
  $('tl-play').textContent = '▶'; $('tl-play').classList.remove('tocando');
  fantasmaAnt.g.visible = false; fantasmaProx.g.visible = false;
  desenharKeys();
});

// Teclado: WASD move cintura, setas movem alvo selecionado, R = repouso.
const teclas = new Set();
window.addEventListener('keydown', (e) => {
  teclas.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'r') poseRepouso();
});
window.addEventListener('keyup', (e) => teclas.delete(e.key.toLowerCase()));

// Joysticks na tela: esquerdo = cintura, direito = bone (espelha o gamepad).
initJoystickVirtual($('joy-base'), $('joy-pino'), (j) => { estado.joy = j; }, 'x');
initJoystickVirtual($('joy2-base'), $('joy2-pino'), (j) => { estado.joyR = j; }, 'y');

// Hook p/ teste E2E (le estado/bones sem expor no UI).
window.__xup = { estado, bones, controles, CONTROLADORES: CONTROLADORES_MOVEIS, palco,
  xbot: () => ({ raiz: xbotRaiz, retarget: !!retarget, usando: usarXbot }) };

// ---------- Loop ----------
const relogio = new THREE.Clock();
const alvoCameras = new THREE.Vector3(0, 1, 0);

function passo(dt) {
  estado.tempo += dt * estado.velocidade;

  // Entrada ESQUERDA: move o controlador selecionado no eixo ativo.
  // Entrada DIREITA: so seleciona (navega a lista no modo selecao).
  let jx = estado.joy.x, jy = 0; // esquerdo: so horizontal (Figma)
  const gp = lerGamepad();
  $('gamepad-status').textContent = gp.conectado ? `Gamepad: ${gp.id.slice(0, 28)}` : 'Gamepad: nenhum (conecte e aperte um botao)';
  if (Math.abs(jx) < 0.05 && gp.conectado) jx = gp.stick.x;
  jx = Math.max(-1, Math.min(1, jx)); jy = Math.max(-1, Math.min(1, jy));
  const cin = bones.cintura;

  const sr = gp.conectado && gp.stickR.intensidade > 0.05 ? gp.stickR : estado.joyR;
  if (gp.conectado) {
    if (bordaSubida(prevBotoes.l1, gp.l1)) ciclarEixo();
    if (bordaSubida(prevBotoes.r1, gp.r1)) alternarModo();
    prevBotoes.l1 = gp.l1; prevBotoes.r1 = gp.r1;
  }
  if ((gp.conectado || sr.intensidade > 0.05) && estado.modo === 'selecao') {
    estado.navCd -= dt;
    linhaEixo.visible = false;
    const dir = sr.y > 0.5 ? -1 : sr.y < -0.5 ? 1 : 0;
    if (dir !== 0 && estado.navCd <= 0) {
      estado.navCd = 0.25;
      const L = CONTROLADORES_MOVEIS;
      selecionarControlador(L[navegarLista(L.indexOf(estado.controlador), dir, L.length)]);
    }
  }

  const ctl = resolverControlador(estado.controlador);
  let s = 0;
  if (estado.modo === 'mover') {
    s = jx; // horizontal empurra o eixo ativo, qualquer que seja
    ctl.position[estado.eixo] = moverNoEixo(ctl.position[estado.eixo], s, { vel: 1.5, dt });
    if (estado.controlador === 'ctrl_cintura') {
      ctl.position.x = fixar(ctl.position.x, -4, 4);
      ctl.position.z = fixar(ctl.position.z, -4, 4);
      ctl.position.y = fixar(ctl.position.y, 0.2, 2);
    }
  }
  // Linha do eixo (cor Blender) + pulso no controlador selecionado.
  linhaEixo.visible = estado.modo === 'mover' && Math.abs(s) > 0.05;
  if (linhaEixo.visible) {
    resolverVisual(estado.controlador).getWorldPosition(_posBone);
    _dirEixo.set(0, 0, 0); _dirEixo[estado.eixo] = 1;
    linhaEixo.position.copy(_posBone);
    linhaEixo.setDirection(_dirEixo);
    linhaEixo.setColor(new THREE.Color(COR_EIXO[estado.eixo]));
  }
  for (const n of CONTROLADORES_MOVEIS) resolverVisual(n).scale.setScalar(n === estado.controlador ? 1.3 : 1);
  $('gpad-modo').textContent = `${estado.modo} · ${estado.controlador} · eixo ${estado.eixo.toUpperCase()}`;
  const ind = $('eixo-ind');
  ind.textContent = estado.eixo.toUpperCase();
  ind.style.color = '#' + COR_EIXO[estado.eixo].toString(16).padStart(6, '0');

  // Setas movem o controlador selecionado (teclado espelha o stick esquerdo).
  const vel = 1.2 * dt;
  if (teclas.has('arrowleft')) ctl.position.x -= vel;
  if (teclas.has('arrowright')) ctl.position.x += vel;
  if (teclas.has('arrowup')) ctl.position.y += vel;
  if (teclas.has('arrowdown')) ctl.position.y -= vel;

  // Limit translation (Maya): controladores so vao ate o limite.
  for (const n of CONTROLADORES_MOVEIS) {
    if (n === 'ctrl_cintura' || !LIMITES_CONTROLE[n]) continue;
    const o = controles[n], b = BASE_CONTROLES[n], L = LIMITES_CONTROLE[n];
    o.position.x = fixarFaixa(o.position.x, b.x, ...L.x);
    o.position.y = fixarFaixa(o.position.y, b.y, ...L.y);
    o.position.z = fixarFaixa(o.position.z, b.z, ...L.z);
    if (n.startsWith('alvo_pe_')) o.position.y = Math.max(o.position.y, PISO_PES);
  }

  // Ciclo de marcha procedural (pausa no modo mover p/ nao brigar com o usuario).
  if (estado.animar && !tl.tocando && estado.modo !== 'mover') {
    const t = estado.tempo * 5;
    const amp = 0.16 + 0.22 * Math.min(1, Math.hypot(jx, jy));
    const bal = Math.sin(t) * amp;
    const liftE = Math.max(0, Math.sin(t)) * 0.12;
    const liftD = Math.max(0, -Math.sin(t)) * 0.12;
    controles.alvo_pe_E.position.z = BASE_ALVOS.alvo_pe_E.z + bal * 0.9;
    controles.alvo_pe_D.position.z = BASE_ALVOS.alvo_pe_D.z - bal * 0.9;
    controles.alvo_pe_E.position.y = Math.max(0.04, BASE_ALVOS.alvo_pe_E.y + liftE - 0.03);
    controles.alvo_pe_D.position.y = Math.max(0.04, BASE_ALVOS.alvo_pe_D.y + liftD - 0.03);
    controles.alvo_mao_E.position.z = BASE_ALVOS.alvo_mao_E.z - bal * 0.7;
    controles.alvo_mao_D.position.z = BASE_ALVOS.alvo_mao_D.z + bal * 0.7;
    cin.position.y = BASE_CINTURA_Y + Math.abs(Math.sin(t)) * 0.03 - 0.01;
  }

  // Timeline: play aplica keys; IK pausa p/ nao brigar com elas.
  if (tl.tocando && tl.keys.length > 1) {
    tl.playhead += dt;
    const s = amostrar(tl.keys, tl.playhead);
    if (s) aplicarPose(bones, s.pose);
    $('tl-frame').textContent = `q${quadroAtual(tl.playhead, tl.fps)} · ${tl.playhead.toFixed(2)}s · ${tl.keys.length} keys`;
  }
  if (tl.onion && tl.keys.length > 1) {
    const s = amostrar(tl.keys, tl.playhead);
    if (s) {
      aplicarPose(fantasmaAnt.mapa, s.anterior);
      aplicarPose(fantasmaProx.mapa, s.proxima);
      fantasmaAnt.g.visible = true; fantasmaProx.g.visible = true;
    }
  }

  // Anel da cintura segue a raiz no chao.
  controles.ctrl_cintura.position.set(cin.position.x, 0.02, cin.position.z);

  // Resolve IK depois de tudo (usa matrizes atualizadas).
  grupo.updateMatrixWorld(true);
  if (!tl.tocando) for (const c of CHAINS) if (estado.ik[c.nome]) aplicarIK(c.nome);
  grupo.updateMatrixWorld(true);
  // Xbot segue nosso rig (controladores continuam nos nossos bones).
  if (retarget && usarXbot) retarget.atualizar();
}

function quadro() {
  requestAnimationFrame(quadro);
  const dt = Math.min(relogio.getDelta(), 0.05);
  passo(dt);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const vps = calcularViewports(w, h);
  bones.cintura.getWorldPosition(alvoCameras);
  alvoCameras.y = Math.max(0.8, alvoCameras.y);
  palco.render(vps, alvoCameras);
}

poseRepouso();
selecionarControlador(estado.controlador);
lerSlidersDoAlvo();

// Referencia do limit translation (pose base canonica).
const BASE_CONTROLES = {};
for (const n of CONTROLADORES_MOVEIS) {
  BASE_CONTROLES[n] = (n === 'ctrl_cintura' ? bones.cintura : controles[n]).position.clone();
}
quadro();
