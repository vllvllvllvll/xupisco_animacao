import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAPA_RETARGET, EXTRAS_RETARGET, validarMapaRetarget } from '../src/rig/retarget.js';
import { listarBones } from '../src/rig/hierarquia.js';
import { verificarENormalizarPesos } from '../src/rig/pesos.js';

describe('retarget Xbot (PT-BR)', () => {
  it('cobre os 19 bones sem duplicar sufixo', () => {
    const r = validarMapaRetarget(listarBones());
    assert.equal(r.ok, true, JSON.stringify(r.erros));
  });

  it('espelha E/D (nosso -X = Right do Xbot)', () => {
    assert.equal(MAPA_RETARGET.ombro_E, 'RightShoulder');
    assert.equal(MAPA_RETARGET.ombro_D, 'LeftShoulder');
    assert.equal(MAPA_RETARGET.coxa_E, 'RightUpLeg');
    assert.equal(MAPA_RETARGET.coxa_D, 'LeftUpLeg');
  });

  it('extras validos (Spine2 + dedos do pe)', () => {
    assert.equal(EXTRAS_RETARGET.length, 3);
    for (const e of EXTRAS_RETARGET) {
      assert.ok(MAPA_RETARGET[e.driver], `driver inexistente: ${e.driver}`);
    }
  });
});

describe('pesos de skin', () => {
  const geo = (pesos) => ({
    count: pesos.length,
    skinIndex: { array: new Array(pesos.length * 4).fill(0) },
    skinWeight: { array: Float32Array.from(pesos.flatMap((s) => [s, 0, 0, 0].slice(0, 4))) },
  });

  it('detecta orfaos e normaliza somas', () => {
    const g = geo([1, 0.5, 0]);
    const r = verificarENormalizarPesos(g);
    assert.equal(r.total, 3);
    assert.equal(r.orfaos, 1); // soma 0: reporta, nao inventa peso
    assert.equal(r.normalizados, 1); // 0.5 → 1
    assert.ok(Math.abs(g.skinWeight.array[4] - 1) < 1e-9);
  });

  it('malha limpa passa zerada', () => {
    const r = verificarENormalizarPesos(geo([1, 1, 1]));
    assert.deepEqual([r.orfaos, r.normalizados], [0, 0]);
  });
});
