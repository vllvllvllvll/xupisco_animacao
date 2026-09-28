import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extrairPose, aplicarPose, interpolarPoses, amostrar, quadroAtual } from '../src/anim/timeline.js';

const fakeBones = () => ({
  cintura: { rotation: { x: 0, y: 0, z: 0, set() {} }, position: { x: 0, y: 1, z: 0, set() {} } },
});

describe('timeline', () => {
  it('extrai pose com rotacao e posicao', () => {
    const p = extrairPose(fakeBones());
    assert.deepEqual(p.cintura, { r: [0, 0, 0], p: [0, 1, 0] });
  });

  it('interpola no meio do caminho', () => {
    const a = { b: { r: [0, 0, 0], p: [0, 0, 0] } };
    const b = { b: { r: [2, 0, 0], p: [0, 4, 0] } };
    const m = interpolarPoses(a, b, 0.5);
    assert.deepEqual(m.b, { r: [1, 0, 0], p: [0, 2, 0] });
  });

  it('amostra entre keys e expoe anterior/proxima p/ onion', () => {
    const k0 = { t: 0, pose: { b: { r: [0, 0, 0], p: [0, 0, 0] } } };
    const k1 = { t: 2, pose: { b: { r: [2, 0, 0], p: [0, 2, 0] } } };
    const s = amostrar([k0, k1], 1);
    assert.deepEqual(s.pose.b.r, [1, 0, 0]);
    assert.equal(s.anterior, k0.pose);
    assert.equal(s.proxima, k1.pose);
  });

  it('vazia retorna null; unica retorna ela mesma', () => {
    assert.equal(amostrar([], 5), null);
    const k = { t: 3, pose: { b: 1 } };
    assert.equal(amostrar([k], 99).pose, k.pose);
  });

  it('loop: apos o fim volta ao inicio', () => {
    const k0 = { t: 0, pose: { b: { r: [0, 0, 0], p: [0, 0, 0] } } };
    const k1 = { t: 2, pose: { b: { r: [2, 0, 0], p: [0, 2, 0] } } };
    const s = amostrar([k0, k1], 3); // 3 % 2 = 1
    assert.deepEqual(s.pose.b.r, [1, 0, 0]);
  });

  it('quadro atual segue o fps', () => {
    assert.equal(quadroAtual(1, 24), 24);
    assert.equal(quadroAtual(0.5, 12), 6);
  });
});
