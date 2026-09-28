import * as THREE from 'three';
import { initPalco } from './cena/palco.js';
import { calcularViewports } from './cena/viewports.js';
import { buildPersonagem } from './rig/personagem.js';
import { listarBones, mapaDePais } from './rig/hierarquia.js';
import { resolverIK2Ossos } from './rig/ik.js';
import { mapearJoystickParaMovimento, fixar, proximoEixo, navegarLista, bordaSubida, moverNoEixo } from './controle/joystick.js';
import { initJoystickVirtual } from './controle/virtual.js';
import { lerGamepad } from './controle/gamepad.js';
import { extrairPose, aplicarPose, amostrar, quadroAtual } from './anim/timeline.js';

const $ = (id) => document.getElementById(id);
const canvas = $('gl');

const palco = initPalco(canvas);
const { grupo, bones, controles } = buildPersonagem();
palco.scene.add(grupo);
palco.scene.add(buildHelper());
function buildHelper() {
  const h = new THREE.SkeletonHelper(bones.cintura);
  h.material.color.set(0xff383c);
  return h;
}

// ---------- Estado ----------
const estado = {
  junta: 'peito',
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
const BONES = listarBones();
const prevBotoes = { l1: false, r1: false };

// Linha do eixo ativo (aparece ao mover o bone com o analogico direito).
const COR_EIXO = 0xff383c;
const linhaEixo = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.6, COR_EIXO, 0.12, 0.06);
linhaEixo.visible = false;
palco.scene.add(linhaEixo);
const _posBone = new THREE.Vector3();
const _quatBone = new THREE.Quaternion();
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

// ---------- UI ----------
const selJunta = $('junta'), selAlvo = $('alvo');
for (const n of listarBones()) {
  const o = document.createElement('option');
  o.value = n; o.textContent = n;
  if (n === estado.junta) o.selected = true;
  selJunta.appendChild(o);
}
for (const n of Object.keys(controles)) {
  if (!n.startsWith('alvo_')) continue;
  const o = document.createElement('option');
  o.value = n; o.textContent = n;
  if (n === estado.alvo) o.selected = true;
  selAlvo.appendChild(o);
}
selJunta.addEventListener('change', () => selecionarJunta(selJunta.value));
selAlvo.addEventListener('change', () => { estado.alvo = selAlvo.value; lerSlidersDoAlvo(); });

// Lista de bones hierarquizada no drawer (indent = profundidade).
const MAPA_PAIS = mapaDePais();
const profundidade = (n) => (MAPA_PAIS[n] ? 1 + profundidade(MAPA_PAIS[n]) : 0);
const botoesBones = {};
for (const n of BONES) {
  const b = document.createElement('button');
  b.textContent = n;
  b.style.paddingLeft = `${4 + profundidade(n) * 12}px`;
  b.addEventListener('click', () => selecionarJunta(n));
  $('bones-lista').appendChild(b);
  botoesBones[n] = b;
}
function selecionarJunta(nome) {
  estado.junta = nome;
  selJunta.value = nome;
  for (const [n, b] of Object.entries(botoesBones)) b.classList.toggle('atual', n === nome);
  lerSlidersDaJunta();
}

const GRAUS = Math.PI / 180;
function lerSlidersDaJunta() {
  const b = bones[estado.junta];
  $('rx').value = Math.round(b.rotation.x / GRAUS);
  $('ry').value = Math.round(b.rotation.y / GRAUS);
  $('rz').value = Math.round(b.rotation.z / GRAUS);
  mostrarValores();
}
for (const id of ['rx', 'ry', 'rz']) {
  $(id).addEventListener('input', () => {
    const b = bones[estado.junta];
    b.rotation.set($('rx').value * GRAUS, $('ry').value * GRAUS, $('rz').value * GRAUS);
    mostrarValores();
  });
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
  $('val-junta').textContent = `${$('rx').value}° ${$('ry').value}° ${$('rz').value}°`;
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
  lerSlidersDaJunta(); lerSlidersDoAlvo();
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
  lerSlidersDaJunta(); lerSlidersDoAlvo();
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
    lerSlidersDaJunta();
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
    b.addEventListener('click', () => { tl.playhead = k.t; aplicarPose(bones, k.pose); lerSlidersDaJunta(); });
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
initJoystickVirtual($('joy-base'), $('joy-pino'), (j) => { estado.joy = j; });
initJoystickVirtual($('joy2-base'), $('joy2-pino'), (j) => { estado.joyR = j; });

// Hook p/ teste E2E (le estado/bones sem expor no UI).
window.__xup = { estado, bones, BONES };

// ---------- Loop ----------
const relogio = new THREE.Clock();
const alvoCameras = new THREE.Vector3(0, 1, 0);

function passo(dt) {
  estado.tempo += dt * estado.velocidade;

  // Entrada: joystick virtual tem prioridade; senao gamepad; senao teclado.
  let jx = estado.joy.x, jy = estado.joy.y;
  const gp = lerGamepad();
  $('gamepad-status').textContent = gp.conectado ? `Gamepad: ${gp.id.slice(0, 28)}` : 'Gamepad: nenhum (conecte e aperte um botao)';
  if (Math.hypot(jx, jy) < 0.05 && gp.conectado) { jx = gp.stick.x; jy = gp.stick.y; }

  // Stick direito (gamepad ou toque): R1 alterna selecao/mover, L1 cicla o eixo.
  const sr = gp.conectado && gp.stickR.intensidade > 0.05 ? gp.stickR : estado.joyR;
  if (gp.conectado) {
    if (bordaSubida(prevBotoes.l1, gp.l1)) ciclarEixo();
    if (bordaSubida(prevBotoes.r1, gp.r1)) alternarModo();
    prevBotoes.l1 = gp.l1; prevBotoes.r1 = gp.r1;
  }
  if (gp.conectado || sr.intensidade > 0.05) {
    estado.navCd -= dt;
    const bone = bones[estado.junta];
    if (estado.modo === 'selecao') {
      linhaEixo.visible = false;
      const dir = sr.y > 0.5 ? -1 : sr.y < -0.5 ? 1 : 0;
      if (dir !== 0 && estado.navCd <= 0) {
        estado.navCd = 0.25;
        selecionarJunta(BONES[navegarLista(BONES.indexOf(estado.junta), dir, BONES.length)]);
      }
    } else {
      const s = estado.eixo === 'y' ? sr.y : sr.x;
      bone.position[estado.eixo] = moverNoEixo(bone.position[estado.eixo], s, { vel: 1.5, dt });
      if (estado.junta === 'cintura') bone.position.y = fixar(bone.position.y, 0.2, 2);
      linhaEixo.visible = Math.abs(s) > 0.05;
      if (linhaEixo.visible) {
        bone.getWorldPosition(_posBone);
        bone.getWorldQuaternion(_quatBone);
        _dirEixo.set(0, 0, 0); _dirEixo[estado.eixo] = 1;
        linhaEixo.position.copy(_posBone);
        linhaEixo.setDirection(_dirEixo.applyQuaternion(_quatBone));
      }
    }
    $('gpad-modo').textContent = `gamepad: ${estado.modo} · ${estado.junta} · eixo ${estado.eixo.toUpperCase()}`;
  } else {
    linhaEixo.visible = false;
    $('gpad-modo').textContent = 'R1 confirma · L1 eixo';
  }
  $('eixo-ind').textContent = estado.eixo.toUpperCase();
  if (teclas.has('w')) jy += 1; if (teclas.has('s')) jy -= 1;
  if (teclas.has('a')) jx -= 1; if (teclas.has('d')) jx += 1;
  jx = Math.max(-1, Math.min(1, jx)); jy = Math.max(-1, Math.min(1, jy));

  const mov = mapearJoystickParaMovimento(jx, jy, { velocidade: 2.2, giro: 2.6, dt });
  const cin = bones.cintura;
  // Move no espaco local do personagem (relativo ao giro atual).
  const frente = new THREE.Vector3(-Math.sin(cin.rotation.y), 0, -Math.cos(cin.rotation.y));
  const lado = new THREE.Vector3(-frente.z, 0, frente.x);
  const passoF = -mov.dz; // dz negativo = frente
  cin.position.addScaledVector(frente, passoF).addScaledVector(lado, mov.dx);
  cin.position.x = Math.max(-4, Math.min(4, cin.position.x));
  cin.position.z = Math.max(-4, Math.min(4, cin.position.z));
  if (Math.abs(jx) > 0.05) cin.rotation.y += mov.giroY * 2;

  // Setas movem o alvo selecionado no plano da camera de frente.
  const vel = 1.2 * dt;
  const al = controles[estado.alvo];
  if (teclas.has('arrowleft')) al.position.x -= vel;
  if (teclas.has('arrowright')) al.position.x += vel;
  if (teclas.has('arrowup')) al.position.y += vel;
  if (teclas.has('arrowdown')) al.position.y -= vel;

  // Ciclo de marcha procedural nos alvos (exercita o IK).
  if (estado.animar) {
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
    // Marcha nao briga com o Y quando o usuario move a cintura no modo mover.
    if (!(estado.modo === 'mover' && estado.junta === 'cintura')) {
      cin.position.y = BASE_CINTURA_Y + Math.abs(Math.sin(t)) * 0.03 - 0.01;
    }
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
selecionarJunta(estado.junta);
lerSlidersDoAlvo();
quadro();
