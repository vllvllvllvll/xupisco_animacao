import * as THREE from 'three';
import { CADEIAS_IK } from './hierarquia.js';

/**
 * Constroi o personagem Xupisco: bones (THREE.Bone) + meshes + controladores.
 * Nomenclatura 100% em portugues. A cintura e a raiz / controlador principal.
 */

const CORES = {
  cintura: 0xffc93c, barriga: 0xff9f45, peito: 0xee5253,
  pescoco: 0xfeca57, cabeca: 0xf9ca24,
  ombro: 0x54a0ff, braco: 0x5f27cd, antebraco: 0x48dbfb, mao: 0x1dd1a1,
  coxa: 0xff6b81, perna: 0xa55eea, pe: 0x26de81,
};

function mat(cor) {
  return new THREE.MeshStandardMaterial({ color: cor, roughness: 0.55, metalness: 0.08 });
}

function elo(texto, raio, comp, cor, eixo = 'y') {
  // Capsula vertical entre a junta e o filho + esfera na junta.
  const g = new THREE.Group();
  const geo = new THREE.CapsuleGeometry(raio, comp, 6, 14);
  const m = new THREE.Mesh(geo, mat(cor));
  if (eixo === 'y') m.position.y = -comp / 2;
  if (eixo === 'x') { m.rotation.z = Math.PI / 2; m.position.x = comp / 2; }
  m.castShadow = true;
  const junta = new THREE.Mesh(new THREE.SphereGeometry(raio * 1.12, 20, 14), mat(cor));
  junta.castShadow = true;
  g.add(m, junta);
  if (texto) g.userData.rotulo = texto;
  return g;
}

function osso(nome, x = 0, y = 0, z = 0) {
  const b = new THREE.Bone();
  b.name = nome;
  b.position.set(x, y, z);
  return b;
}

function anelControle(cor, raio, tubo = 0.022) {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(raio, tubo, 12, 40),
    new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.95 }),
  );
  m.rotation.x = Math.PI / 2;
  return m;
}

function alvoControle(cor, raio = 0.09) {
  const g = new THREE.Group();
  const solido = new THREE.Mesh(
    new THREE.SphereGeometry(raio, 18, 12),
    new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.55 }),
  );
  const arame = new THREE.Mesh(
    new THREE.SphereGeometry(raio * 1.25, 12, 8),
    new THREE.MeshBasicMaterial({ color: cor, wireframe: true }),
  );
  g.add(solido, arame);
  return g;
}

function poloControle(cor) {
  const m = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.07),
    new THREE.MeshBasicMaterial({ color: cor, wireframe: true }),
  );
  return m;
}

export function buildPersonagem() {
  const grupo = new THREE.Group();
  grupo.name = 'xupisco';
  const bones = {};
  const meshes = {};
  const controles = {};

  // ---- Bones (hierarquia PT-BR) ----
  const cintura = osso('cintura', 0, 1.02, 0);
  const barriga = osso('barriga', 0, 0.14, 0);
  const peito = osso('peito', 0, 0.16, 0);
  const pescoco = osso('pescoco', 0, 0.20, 0);
  const cabeca = osso('cabeca', 0, 0.14, 0);
  cintura.add(barriga); barriga.add(peito); peito.add(pescoco); pescoco.add(cabeca);

  const lados = ['E', 'D'];
  const sx = { E: -1, D: 1 };
  for (const L of lados) {
    const ombro = osso(`ombro_${L}`, 0.24 * sx[L], 0.13, 0);
    const braco = osso(`braco_${L}`, 0, -0.26, 0);
    const antebraco = osso(`antebraco_${L}`, 0, -0.26, 0);
    const mao = osso(`mao_${L}`, 0, -0.14, 0);
    peito.add(ombro); ombro.add(braco); braco.add(antebraco); antebraco.add(mao);
    bones[`ombro_${L}`] = ombro; bones[`braco_${L}`] = braco;
    bones[`antebraco_${L}`] = antebraco; bones[`mao_${L}`] = mao;

    const coxa = osso(`coxa_${L}`, 0.11 * sx[L], -0.08, 0);
    const perna = osso(`perna_${L}`, 0, -0.40, 0);
    const pe = osso(`pe_${L}`, 0, -0.40, 0);
    cintura.add(coxa); coxa.add(perna); perna.add(pe);
    bones[`coxa_${L}`] = coxa; bones[`perna_${L}`] = perna; bones[`pe_${L}`] = pe;
  }
  bones.cintura = cintura; bones.barriga = barriga; bones.peito = peito;
  bones.pescoco = pescoco; bones.cabeca = cabeca;

  // ---- Meshes parentadas aos bones ----
  const addMesh = (boneNome, obj) => { bones[boneNome].add(obj); meshes[boneNome] = obj; };
  addMesh('cintura', elo('cintura', 0.16, 0.10, CORES.cintura));
  addMesh('barriga', elo('barriga', 0.145, 0.10, CORES.barriga));
  addMesh('peito', elo('peito', 0.17, 0.12, CORES.peito));
  addMesh('pescoco', elo('pescoco', 0.06, 0.08, CORES.pescoco));

  const cabecaG = new THREE.Group();
  const cranio = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 18), mat(CORES.cabeca));
  cranio.position.y = 0.10; cranio.castShadow = true;
  const olhoGeo = new THREE.SphereGeometry(0.028, 12, 10);
  const olhoMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const olhoE = new THREE.Mesh(olhoGeo, olhoMat); olhoE.position.set(-0.055, 0.12, 0.125);
  const olhoD = new THREE.Mesh(olhoGeo, olhoMat); olhoD.position.set(0.055, 0.12, 0.125);
  cabecaG.add(cranio, olhoE, olhoD);
  addMesh('cabeca', cabecaG);

  for (const L of lados) {
    addMesh(`ombro_${L}`, elo(`ombro_${L}`, 0.075, 0.06, CORES.ombro));
    addMesh(`braco_${L}`, elo(`braco_${L}`, 0.062, 0.16, CORES.braco));
    addMesh(`antebraco_${L}`, elo(`antebraco_${L}`, 0.052, 0.15, CORES.antebraco));
    const maoG = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 14), mat(CORES.mao));
    maoG.position.y = -0.07; maoG.castShadow = true;
    addMesh(`mao_${L}`, maoG);
    addMesh(`coxa_${L}`, elo(`coxa_${L}`, 0.085, 0.26, CORES.coxa));
    addMesh(`perna_${L}`, elo(`perna_${L}`, 0.068, 0.26, CORES.perna));
    const peG = new THREE.Group();
    const peM = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.24), mat(CORES.pe));
    peM.position.set(0, -0.035, 0.06); peM.castShadow = true;
    peG.add(peM);
    addMesh(`pe_${L}`, peG);
  }

  grupo.add(cintura);

  // ---- Controladores (curvas/primitivas geometricas) ----
  const ctrlCintura = anelControle(0xffc93c, 0.62);
  ctrlCintura.name = 'ctrl_cintura';
  const ctrlBarriga = anelControle(0xff9f45, 0.34, 0.016);
  const ctrlPeito = anelControle(0xee5253, 0.40, 0.016);
  const ctrlCabeca = anelControle(0xf9ca24, 0.24, 0.014);
  ctrlCabeca.rotation.x = 0;
  controles.ctrl_cintura = ctrlCintura;
  controles.ctrl_barriga = ctrlBarriga;
  controles.ctrl_peito = ctrlPeito;
  controles.ctrl_cabeca = ctrlCabeca;
  grupo.add(ctrlCintura);
  bones.barriga.add(ctrlBarriga);
  bones.peito.add(ctrlPeito);
  bones.cabeca.add(ctrlCabeca);
  ctrlBarriga.position.y = 0.02; ctrlPeito.position.y = 0.02; ctrlCabeca.position.y = 0.12;

  // Alvos IK (maos + pes) e polos (cotovelos + joelhos)
  const tmp = new THREE.Vector3();
  const colocarNoMundo = (obj, boneNome, offset = new THREE.Vector3()) => {
    bones[boneNome].updateWorldMatrix(true, false);
    tmp.setFromMatrixPosition(bones[boneNome].matrixWorld).add(offset);
    obj.position.copy(grupo.worldToLocal(tmp.clone()));
  };

  grupo.updateMatrixWorld(true);
  const defs = [
    ['alvo_mao_E', 0x1dd1a1], ['alvo_mao_D', 0x1dd1a1],
    ['alvo_pe_E', 0x26de81], ['alvo_pe_D', 0x26de81],
  ];
  for (const [nome, cor] of defs) {
    const a = alvoControle(cor);
    a.name = nome;
    grupo.add(a);
    controles[nome] = a;
  }
  const polos = [
    ['polo_cotovelo_E', 0x54a0ff], ['polo_cotovelo_D', 0x54a0ff],
    ['polo_joelho_E', 0xa55eea], ['polo_joelho_D', 0xa55eea],
  ];
  for (const [nome, cor] of polos) {
    const p = poloControle(cor);
    p.name = nome;
    grupo.add(p);
    controles[nome] = p;
  }

  // Posicao inicial dos alvos: perto das extremidades em repouso.
  grupo.updateMatrixWorld(true);
  colocarNoMundo(controles.alvo_mao_E, 'mao_E');
  colocarNoMundo(controles.alvo_mao_D, 'mao_D');
  colocarNoMundo(controles.alvo_pe_E, 'pe_E', new THREE.Vector3(0, 0.05, 0.05));
  colocarNoMundo(controles.alvo_pe_D, 'pe_D', new THREE.Vector3(0, 0.05, 0.05));
  colocarNoMundo(controles.polo_cotovelo_E, 'antebraco_E', new THREE.Vector3(-0.35, 0, -0.35));
  colocarNoMundo(controles.polo_cotovelo_D, 'antebraco_D', new THREE.Vector3(0.35, 0, -0.35));
  colocarNoMundo(controles.polo_joelho_E, 'perna_E', new THREE.Vector3(0, 0, 0.45));
  colocarNoMundo(controles.polo_joelho_D, 'perna_D', new THREE.Vector3(0, 0, 0.45));

  const helper = new THREE.SkeletonHelper(cintura);
  helper.material.linewidth = 2;

  return { grupo, bones, meshes, controles, cadeias: CADEIAS_IK, helper };
}
