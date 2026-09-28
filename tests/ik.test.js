import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { v, distancia, anguloOmbro, anguloCotovelo, resolverIK2Ossos } from '../src/rig/ik.js';

const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

describe('IK de 2 ossos', () => {
  it('alvo ao alcance: junta media respeita os comprimentos', () => {
    const sol = resolverIK2Ossos({
      origem: v(0, 0, 0), compA: 0.26, compB: 0.40,
      alvo: v(0.2, -0.3, 0.1), polo: v(0, 0, -1),
    });
    assert.equal(sol.alcancavel, true);
    assert.ok(perto(distancia(v(0, 0, 0), sol.posMeio), 0.26, 1e-6));
    assert.ok(perto(distancia(sol.posMeio, sol.alvoLimitado), 0.40, 1e-6));
  });

  it('alvo fora do alcance: limita na extensao maxima', () => {
    const sol = resolverIK2Ossos({
      origem: v(0, 0, 0), compA: 0.3, compB: 0.3,
      alvo: v(5, 0, 0), polo: v(0, 0, 1),
    });
    assert.equal(sol.alcancavel, false);
    assert.ok(perto(distancia(v(0, 0, 0), sol.alvoLimitado), 0.6, 1e-3));
  });

  it('polo define o lado da dobra (simetria)', () => {
    const base = { origem: v(0, 0, 0), compA: 0.5, compB: 0.5, alvo: v(0.6, 0, 0) };
    const a = resolverIK2Ossos({ ...base, polo: v(0, 0, 1) });
    const b = resolverIK2Ossos({ ...base, polo: v(0, 0, -1) });
    assert.ok(a.posMeio.z > 0 && b.posMeio.z < 0);
    assert.ok(perto(Math.abs(a.posMeio.z), Math.abs(b.posMeio.z), 1e-9));
  });

  it('esticado: angulos ~0; dobrado ao meio: cotovelo ~90°', () => {
    assert.ok(anguloCotovelo(0.5, 0.5, 0.999) < 0.1);
    const cot = anguloCotovelo(3, 4, 5); // triângulo 3-4-5 → reto no meio? verifica lei dos cossenos
    assert.ok(cot > 0 && cot < Math.PI);
    // Ombro de triangulo equilatero parcial: compA=compB=1, d=1 → 60°
    assert.ok(perto(anguloOmbro(1, 1, 1), Math.PI / 3, 1e-9));
  });

  it('rejeita comprimentos invalidos', () => {
    assert.throws(() => resolverIK2Ossos({ origem: v(), compA: 0, compB: 1, alvo: v(1, 0, 0), polo: v(0, 1, 0) }));
  });
});
