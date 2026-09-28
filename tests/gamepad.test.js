import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { proximoEixo, navegarLista, bordaSubida, moverNoEixo } from '../src/controle/joystick.js';

describe('gamepad: selecao/modo/eixo', () => {
  it('L1 cicla x → y → z → x', () => {
    assert.equal(proximoEixo('x'), 'y');
    assert.equal(proximoEixo('y'), 'z');
    assert.equal(proximoEixo('z'), 'x');
  });

  it('lista de bones navega e da a volta', () => {
    assert.equal(navegarLista(0, 1, 19), 1);
    assert.equal(navegarLista(18, 1, 19), 0);
    assert.equal(navegarLista(0, -1, 19), 18);
  });

  it('L1/R1 so disparam na borda (segurar nao repete)', () => {
    assert.equal(bordaSubida(false, true), true);
    assert.equal(bordaSubida(true, true), false);
    assert.equal(bordaSubida(false, false), false);
    assert.equal(bordaSubida(true, false), false);
  });

  it('move no eixo com clamp', () => {
    const v = moverNoEixo(0, 1, { vel: 2, dt: 0.5 });
    assert.equal(v, 1);
    assert.equal(moverNoEixo(1.9, 1, { vel: 2, dt: 0.5 }), 2);
    assert.equal(moverNoEixo(0, 0, { vel: 2, dt: 0.5 }), 0);
  });
});
