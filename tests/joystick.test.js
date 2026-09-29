import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { limitarVetor, aplicarZonaMorta, mapearJoystickParaMovimento, normalizarEixoGamepad, travarEixo } from '../src/controle/joystick.js';

describe('joystick', () => {
  it('limita ao raio com intensidade 1 na borda', () => {
    const l = limitarVetor(100, 0, 50);
    assert.equal(l.x, 50);
    assert.equal(l.intensidade, 1);
  });

  it('centro parado tem intensidade 0', () => {
    const l = limitarVetor(0, 0, 50);
    assert.equal(l.intensidade, 0);
  });

  it('zona morta zera tremor e preserva comando cheio', () => {
    const z = aplicarZonaMorta(0.05, 0.05);
    assert.deepEqual(z, { x: 0, y: 0 });
    const cheio = aplicarZonaMorta(1, 0);
    assert.ok(Math.abs(cheio.x - 1) < 1e-9);
  });

  it('mapeia p/ movimento: frente = -Z, escala por dt', () => {
    const m = mapearJoystickParaMovimento(0, 1, { velocidade: 2, giro: 0, dt: 0.5 });
    assert.equal(m.dx, 0);
    assert.ok(m.dz < 0); // frente da cena
    assert.ok(Math.abs(m.dz) <= 2 * 0.5 + 1e-9);
  });

  it('direita gira (giroY != 0) e parado nao anda', () => {
    const m = mapearJoystickParaMovimento(1, 0, { velocidade: 2, giro: 2, dt: 1 });
    assert.notEqual(m.giroY, 0);
    const p = mapearJoystickParaMovimento(0, 0, { velocidade: 2, giro: 2, dt: 1 });
    assert.ok(p.dx === 0 && p.dz === 0 && p.giroY === 0);
  });

  it('eixo de gamepad invalido vira 0 e clamp funciona', () => {
    assert.equal(normalizarEixoGamepad(NaN), 0);
    assert.equal(normalizarEixoGamepad(5), 1);
    assert.equal(normalizarEixoGamepad(-5), -1);
  });

  it('trava do analogico (Figma): esq so-x, dir so-y', () => {
    assert.deepEqual(travarEixo(0.7, 0.9, 'x'), [0.7, 0]);
    assert.deepEqual(travarEixo(0.7, 0.9, 'y'), [0, 0.9]);
    assert.deepEqual(travarEixo(0.7, 0.9, null), [0.7, 0.9]);
  });
});
