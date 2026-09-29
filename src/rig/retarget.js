import * as THREE from 'three';

/**
 * Retarget do rig PT-BR (nosso) para o Xbot (Mixamo).
 * Copia a rotacao-relativa-ao-repouso de cada bone nosso p/ o correspondente,
 * entao IK, controladores e timeline continuam intactos. Pesos nao sao tocados.
 * E = lado -X do nosso rig = lado Right do Xbot (espelho).
 */

// Nosso bone → sufixo do bone Xbot (match por fim do nome, ignora prefixo mixamorig:).
export const MAPA_RETARGET = {
  cintura: 'Hips',
  barriga: 'Spine',
  peito: 'Spine1',
  pescoco: 'Neck',
  cabeca: 'Head',
  ombro_E: 'RightShoulder', braco_E: 'RightArm', antebraco_E: 'RightForeArm', mao_E: 'RightHand',
  ombro_D: 'LeftShoulder', braco_D: 'LeftArm', antebraco_D: 'LeftForeArm', mao_D: 'LeftHand',
  coxa_E: 'RightUpLeg', perna_E: 'RightLeg', pe_E: 'RightFoot',
  coxa_D: 'LeftUpLeg', perna_D: 'LeftLeg', pe_D: 'LeftFoot',
};

// Bones extras do Xbot que herdam o driver indicado (nao existem no nosso rig).
export const EXTRAS_RETARGET = [
  { xbot: 'Spine2', driver: 'peito' },
  { xbot: 'LeftToeBase', driver: 'pe_D' },
  { xbot: 'RightToeBase', driver: 'pe_E' },
];

/** Acha bone pelo sufixo do nome (ex. 'mixamorig:Hips' casa 'Hips'). */
export function acharOssoPorSufixo(raiz, sufixo) {
  let achado = null;
  raiz.traverse((o) => {
    if (o.isBone && (o.name === sufixo || o.name.endsWith(':' + sufixo) || o.name.endsWith(sufixo))) achado = achado || o;
  });
  return achado;
}

/** Valida o mapa contra a lista de bones PT (testavel sem three). */
export function validarMapaRetarget(nomesPT) {
  const erros = [];
  for (const n of nomesPT) if (!MAPA_RETARGET[n]) erros.push(`sem par Xbot: ${n}`);
  const alvos = Object.values(MAPA_RETARGET);
  if (new Set(alvos).size !== alvos.length) erros.push('sufixo Xbot duplicado no mapa');
  return { ok: erros.length === 0, erros };
}

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qw = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _t = new THREE.Quaternion();
const _dX = new THREE.Vector3();
const _dO = new THREE.Vector3();
const _c = new THREE.Quaternion();

// Nosso bone → filho que define sua direcao (ends herdam a correcao do pai).
const FILHO_DIR = {
  barriga: 'peito', peito: 'pescoco', pescoco: 'cabeca',
  ombro_E: 'braco_E', braco_E: 'antebraco_E', antebraco_E: 'mao_E',
  ombro_D: 'braco_D', braco_D: 'antebraco_D', antebraco_D: 'mao_D',
  coxa_E: 'perna_E', perna_E: 'pe_E', coxa_D: 'perna_D', perna_D: 'pe_D',
};

function topo(obj) {
  let o = obj;
  while (o.parent) o = o.parent;
  return o;
}

/**
 * Alinha o repouso do Xbot ao nosso (ex. bracos descem em vez de abrir em T).
 * Roda uma vez no bind; o delta-copy por frame passa a ser exato.
 */
function assarRepouso(nossos, ossosXbot, ordem) {
  const corr = {};
  for (const pt of ordem) {
    topo(nossos[pt]).updateMatrixWorld(true);
    topo(ossosXbot[pt]).updateMatrixWorld(true);
    const O = nossos[pt], X = ossosXbot[pt];
    let q = corr[pt] || null;
    const filho = FILHO_DIR[pt];
    if (filho) {
      const Oc = nossos[filho], Xc = ossosXbot[filho];
      O.getWorldPosition(_p);
      Oc.getWorldPosition(_dO).sub(_p);
      X.getWorldPosition(_p);
      Xc.getWorldPosition(_dX).sub(_p);
      // ossosXbot[filho] pode nao ser filho direto (ex. pescoco sob Spine2): vale a direcao.
      if (_dO.lengthSq() > 1e-10 && _dX.lengthSq() > 1e-10) {
        q = new THREE.Quaternion().setFromUnitVectors(_dX.normalize(), _dO.normalize());
      }
    }
    if (!q) q = corrPai(pt, corr);
    corr[pt] = q;
    X.getWorldQuaternion(_qw);
    X.parent.getWorldQuaternion(_pq);
    X.quaternion.copy(_pq.invert().multiply(q).multiply(_qw));
  }
}

// Ordem hierarquica (pais antes dos filhos) — mesma usada no update.
const ORDEM = ['cintura', 'barriga', 'peito', 'pescoco', 'cabeca',
  'ombro_E', 'braco_E', 'antebraco_E', 'mao_E',
  'ombro_D', 'braco_D', 'antebraco_D', 'mao_D',
  'coxa_E', 'perna_E', 'pe_E', 'coxa_D', 'perna_D', 'pe_D'];
const PAI = { barriga: 'cintura', peito: 'barriga', pescoco: 'peito', cabeca: 'pescoco' };
for (const L of ['E', 'D']) {
  PAI[`ombro_${L}`] = 'peito'; PAI[`braco_${L}`] = `ombro_${L}`;
  PAI[`antebraco_${L}`] = `braco_${L}`; PAI[`mao_${L}`] = `antebraco_${L}`;
  PAI[`coxa_${L}`] = 'cintura'; PAI[`perna_${L}`] = `coxa_${L}`; PAI[`pe_${L}`] = `perna_${L}`;
}
function corrPai(pt, corr) {
  // Sobe ate achar correcao (cintura = identidade).
  let p = PAI[pt];
  while (p) {
    if (corr[p]) return corr[p].clone();
    p = PAI[p];
  }
  return new THREE.Quaternion();
}

function copiarMundo(nosso, xbot, restO, restX, moverPosicao) {
  nosso.getWorldPosition(_p);
  nosso.getWorldQuaternion(_q);
  // X_mundo = X_repouso * inv(O_repouso) * O_atual
  _qw.copy(restX.q).multiply(_t.copy(restO.q).invert()).multiply(_q);
  xbot.parent.getWorldQuaternion(_pq).invert();
  xbot.quaternion.copy(_pq.multiply(_qw));
  if (moverPosicao) {
    _p.add(restX.off); // off = X_repouso_pos - O_repouso_pos
    xbot.parent.worldToLocal(_p);
    xbot.position.copy(_p);
  }
}

/**
 * Prepara o retarget (captura repouso dos dois rigs). Chamar com tudo em repouso.
 * @returns {{atualizar: () => void, ossosXbot: object}}
 */
export function criarRetarget(nossos, raizXbot) {
  const ossosXbot = {};
  for (const [pt, suf] of Object.entries(MAPA_RETARGET)) {
    const b = acharOssoPorSufixo(raizXbot, suf);
    if (!b) throw new Error(`bone Xbot nao achado: ${suf}`);
    ossosXbot[pt] = b;
  }
  const extras = EXTRAS_RETARGET.map(({ xbot, driver }) => {
    const b = acharOssoPorSufixo(raizXbot, xbot);
    if (!b) throw new Error(`bone Xbot extra nao achado: ${xbot}`);
    return { b, driver };
  });

  // Alinha o repouso do Xbot ao nosso ANTES de capturar (bracos descem, etc).
  assarRepouso(nossos, ossosXbot, ORDEM);

  const restO = {}, restX = {};
  for (const pt of ORDEM) {
    nossos[pt].getWorldPosition(_p); nossos[pt].getWorldQuaternion(_q);
    restO[pt] = { p: _p.clone(), q: _q.clone() };
    ossosXbot[pt].getWorldPosition(_p); ossosXbot[pt].getWorldQuaternion(_q);
    // Raiz gruda no nosso cintura (off zero); resto preserva offset de repouso.
    restX[pt] = { p: _p.clone(), q: _q.clone(), off: pt === 'cintura' ? new THREE.Vector3() : _p.clone().sub(restO[pt].p) };
  }
  const restExtras = extras.map(({ b }) => {
    b.getWorldQuaternion(_q);
    return { q: _q.clone(), off: new THREE.Vector3() };
  });

  function atualizar() {
    for (const pt of ORDEM) {
      copiarMundo(nossos[pt], ossosXbot[pt], restO[pt], restX[pt], pt === 'cintura');
    }
    extras.forEach(({ b, driver }, i) => copiarMundo(nossos[driver], b, restO[driver], restExtras[i], false));
  }
  return { atualizar, ossosXbot };
}
