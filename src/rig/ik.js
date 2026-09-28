/**
 * IK de 2 ossos — matematica pura (sem Three.js) para ser testavel com node:test.
 * Vetores sao {x, y, z}.
 */

export const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
export const add = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
export const escala = (a, s) => v(a.x * s, a.y * s, a.z * s);
export const ponto = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cruz = (a, b) => v(
  a.y * b.z - a.z * b.y,
  a.z * b.x - a.x * b.z,
  a.x * b.y - a.y * b.x,
);
export const tamanho = (a) => Math.hypot(a.x, a.y, a.z);
export const normalizar = (a) => {
  const t = tamanho(a);
  return t < 1e-9 ? v(0, 0, 0) : escala(a, 1 / t);
};
export const distancia = (a, b) => tamanho(sub(a, b));
export const fixar = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * Lei dos cossenos: angulo interno no ombro entre o eixo raiz→alvo
 * e o primeiro osso, dados os comprimentos.
 */
export function anguloOmbro(compA, compB, distAlvo) {
  const d = fixar(distAlvo, Math.abs(compA - compB) + 1e-6, compA + compB - 1e-6);
  const cosA = fixar((compA * compA + d * d - compB * compB) / (2 * compA * d), -1, 1);
  return Math.acos(cosA);
}

/** Angulo interno no cotovelo/joelho (0 = esticado). Retorna flexao 0..PI. */
export function anguloCotovelo(compA, compB, distAlvo) {
  const d = fixar(distAlvo, Math.abs(compA - compB) + 1e-6, compA + compB - 1e-6);
  const cosC = fixar((compA * compA + compB * compB - d * d) / (2 * compA * compB), -1, 1);
  return Math.PI - Math.acos(cosC); // 0 esticado → PI dobrado
}

/**
 * Resolve a posicao da junta do meio (cotovelo/joelho).
 *
 * @param {object} p
 * @param {{x,y,z}} p.origem  posicao da raiz (ombro/coxa)
 * @param {number} p.compA    comprimento raiz→meio
 * @param {number} p.compB    comprimento meio→efetor
 * @param {{x,y,z}} p.alvo    posicao desejada do efetor
 * @param {{x,y,z}} p.polo    direcao preferida do meio (cotovelo/joelho)
 * @returns {{alcancavel:boolean, alvoLimitado:object, posMeio:object, anguloA:number, anguloB:number, distanciaAlvo:number}}
 */
export function resolverIK2Ossos({ origem, compA, compB, alvo, polo }) {
  if (compA <= 0 || compB <= 0) throw new Error('comprimentos devem ser positivos');
  const dirAlvo = sub(alvo, origem);
  let d = tamanho(dirAlvo);
  const alcanceMax = compA + compB;
  const alcanceMin = Math.abs(compA - compB);
  const alcancavel = d <= alcanceMax && d >= alcanceMin && d > 1e-9;

  const eixo = d < 1e-9 ? v(0, -1, 0) : normalizar(dirAlvo);
  const dLim = fixar(d, Math.max(alcanceMin + 1e-6, 1e-6), alcanceMax - 1e-6);
  const alvoLimitado = add(origem, escala(eixo, dLim));

  // Componente do polo perpendicular ao eixo raiz→alvo define o plano de dobra.
  const poloRel = sub(polo, origem);
  let lateral = sub(poloRel, escala(eixo, ponto(poloRel, eixo)));
  if (tamanho(lateral) < 1e-6) {
    // Polo degenerado: escolhe qualquer perpendicular estavel.
    const ref = Math.abs(eixo.y) < 0.9 ? v(0, 1, 0) : v(1, 0, 0);
    lateral = sub(ref, escala(eixo, ponto(ref, eixo)));
  }
  const lado = normalizar(lateral);

  // Distancia da origem ate o pe da altura + altura do triangulo.
  const a1 = (compA * compA - compB * compB + dLim * dLim) / (2 * dLim);
  const h2 = compA * compA - a1 * a1;
  const h = Math.sqrt(Math.max(0, h2));
  const posMeio = add(add(origem, escala(eixo, a1)), escala(lado, h));

  return {
    alcancavel,
    alvoLimitado,
    posMeio,
    anguloA: anguloOmbro(compA, compB, d),
    anguloB: anguloCotovelo(compA, compB, d),
    distanciaAlvo: d,
  };
}
