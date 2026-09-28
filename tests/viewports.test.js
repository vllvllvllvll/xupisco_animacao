import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularViewports, cssParaScissor, aspecto } from '../src/cena/viewports.js';

describe('viewports do painel', () => {
  it('divide: esq=frente cheia, dir metade cima/metade lateral', () => {
    const v = calcularViewports(1000, 800);
    assert.deepEqual(v.frente, { x: 0, y: 0, w: 500, h: 800 });
    assert.deepEqual(v.cima, { x: 500, y: 0, w: 500, h: 400 });
    assert.deepEqual(v.lateral, { x: 500, y: 400, w: 500, h: 400 });
  });

  it('cobre a tela sem buracos nem sobreposicao', () => {
    const v = calcularViewports(1280, 720);
    const area = v.frente.w * v.frente.h + v.cima.w * v.cima.h + v.lateral.w * v.lateral.h;
    assert.equal(area, 1280 * 720);
    assert.equal(v.frente.w + v.cima.w, 1280);
    assert.equal(v.cima.h + v.lateral.h, 720);
  });

  it('converte CSS→scissor (origem base do WebGL)', () => {
    const s = cssParaScissor({ x: 500, y: 0, w: 500, h: 400 }, 800);
    assert.deepEqual(s, { x: 500, y: 400, w: 500, h: 400 });
  });

  it('aspecto das vistas', () => {
    const v = calcularViewports(1000, 800);
    assert.equal(aspecto(v.frente), 500 / 800);
    assert.equal(aspecto(v.cima), 500 / 400);
  });
});
