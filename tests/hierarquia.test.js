import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HIERARQUIA, CADEIAS_IK, CONTROLADORES, listarBones, mapaDePais, validarHierarquia, RAIZ } from '../src/rig/hierarquia.js';

describe('hierarquia do rig (PT-BR)', () => {
  it('raiz e unica e se chama cintura', () => {
    assert.deepEqual(Object.keys(HIERARQUIA), [RAIZ]);
  });

  it('tem 19 bones com os nomes em portugues', () => {
    const nomes = listarBones();
    assert.equal(nomes.length, 19);
    for (const esperado of ['cintura', 'barriga', 'peito', 'pescoco', 'cabeca']) {
      assert.ok(nomes.includes(esperado), `falta ${esperado}`);
    }
    for (const L of ['E', 'D']) {
      for (const b of [`ombro_${L}`, `braco_${L}`, `antebraco_${L}`, `mao_${L}`, `coxa_${L}`, `perna_${L}`, `pe_${L}`]) {
        assert.ok(nomes.includes(b), `falta ${b}`);
      }
    }
  });

  it('pais corretos (tronco sobe, bracos saem do peito, pernas da cintura)', () => {
    const mapa = mapaDePais();
    assert.equal(mapa.barriga, 'cintura');
    assert.equal(mapa.peito, 'barriga');
    assert.equal(mapa.pescoco, 'peito');
    assert.equal(mapa.cabeca, 'pescoco');
    assert.equal(mapa.ombro_E, 'peito');
    assert.equal(mapa.braco_E, 'ombro_E');
    assert.equal(mapa.antebraco_E, 'braco_E');
    assert.equal(mapa.mao_E, 'antebraco_E');
    assert.equal(mapa.coxa_D, 'cintura');
    assert.equal(mapa.perna_D, 'coxa_D');
    assert.equal(mapa.pe_D, 'perna_D');
  });

  it('validacao passa sem erros', () => {
    const r = validarHierarquia();
    assert.equal(r.ok, true, JSON.stringify(r.erros));
    assert.equal(r.totalBones, 19);
  });

  it('4 cadeias IK com raiz/meio/efetor existentes', () => {
    assert.equal(CADEIAS_IK.length, 4);
    const nomes = new Set(listarBones());
    for (const c of CADEIAS_IK) {
      assert.ok(nomes.has(c.raiz) && nomes.has(c.meio) && nomes.has(c.efetor), JSON.stringify(c));
      assert.ok(c.alvo && c.polo, `cadeia ${c.nome} sem alvo/polo`);
    }
  });

  it('15 controladores geometricos nomeados', () => {
    assert.equal(CONTROLADORES.length, 15);
    assert.ok(CONTROLADORES.includes('ctrl_cintura'));
    assert.ok(CONTROLADORES.includes('alvo_mao_E'));
    assert.ok(CONTROLADORES.includes('polo_joelho_D'));
  });
});
