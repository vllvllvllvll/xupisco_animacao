/**
 * Layout do painel dividido em 2 colunas:
 * - esquerda (50% largura, 100% altura): camera de frente
 * - direita-cima (50% x 50%): camera de cima
 * - direita-baixo (50% x 50%): camera lateral
 * Retangulos em pixels, origem topo-esquerda (CSS).
 */

export function calcularViewports(largura, altura) {
  const w = Math.max(1, Math.floor(largura));
  const h = Math.max(1, Math.floor(altura));
  const meiaLarg = Math.floor(w / 2);
  const meiaAlt = Math.floor(h / 2);
  return {
    frente: { x: 0, y: 0, w: meiaLarg, h },
    cima: { x: meiaLarg, y: 0, w: w - meiaLarg, h: meiaAlt },
    lateral: { x: meiaLarg, y: meiaAlt, w: w - meiaLarg, h: h - meiaAlt },
  };
}

/** Converte retangulo CSS (origem topo) para scissor WebGL (origem base). */
export function cssParaScissor(rect, alturaCanvas) {
  return {
    x: rect.x,
    y: alturaCanvas - (rect.y + rect.h),
    w: rect.w,
    h: rect.h,
  };
}

/** Aspecto de um retangulo (evita divisao por zero). */
export function aspecto(rect) {
  return rect.h > 0 ? rect.w / rect.h : 1;
}
