import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(raiz, 'index.html'), 'utf8');
const main = readFileSync(path.join(raiz, 'src', 'main.js'), 'utf8');

describe('wiring UI (ids do HTML x JS)', () => {
  it("todo $('id') estatico existe no index.html", () => {
    const usados = [...main.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]);
    assert.ok(usados.length > 10, 'esperava varios ids usados');
    for (const id of new Set(usados)) {
      assert.ok(html.includes(`id="${id}"`), `id usado no JS mas fora do HTML: ${id}`);
    }
  });

  it('checkboxes IK dinamicos `ik-<cadeia>` existem no HTML', () => {
    for (const nome of ['braco_E', 'braco_D', 'perna_E', 'perna_D']) {
      assert.ok(html.includes(`id="ik-${nome}"`), `falta ik-${nome}`);
    }
  });

  it('divs do HTML balanceadas (layout docked quebra se faltar fechamento)', () => {
    const opens = (html.match(/<div\b/g) || []).length;
    const closes = (html.match(/<\/div>/g) || []).length;
    assert.equal(opens, closes, `divs: ${opens} abrem, ${closes} fecham`);
  });

  it('drawer usa details colapsaveis (lista curta, R1 livre)', () => {
    for (const s of ['Controladores', 'Alvo IK', 'IK ligado', 'Poses']) {
      assert.ok(html.includes(`<summary>${s}</summary>`), `falta details ${s}`);
    }
    assert.ok(!html.includes('id="junta"'), 'bones (select junta) nao podem existir no HTML');
  });
});
