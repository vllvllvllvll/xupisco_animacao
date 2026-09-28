/** Matematica do joystick virtual + Gamepad — pura e testavel. */

export const fixar = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * Limita o vetor do joystick ao raio maximo e devolve intensidade 0..1 + angulo.
 * @returns {{x:number,y:number,intensidade:number,angulo:number}}
 */
export function limitarVetor(x, y, raioMax = 50) {
  const mag = Math.hypot(x, y);
  let cx = x, cy = y;
  if (mag > raioMax && mag > 0) {
    const s = raioMax / mag;
    cx = x * s;
    cy = y * s;
  }
  const intensidade = fixar(Math.hypot(cx, cy) / raioMax, 0, 1);
  return { x: cx, y: cy, intensidade, angulo: Math.atan2(cy, cx) };
}

/** Zona morta radial: valores abaixo da zona viram 0, o resto e renormalizado. */
export function aplicarZonaMorta(x, y, zona = 0.12) {
  const mag = Math.hypot(x, y);
  if (mag < zona) return { x: 0, y: 0 };
  const s = (mag - zona) / (1 - zona) / (mag || 1);
  return { x: fixar(x * s, -1, 1), y: fixar(y * s, -1, 1) };
}

/**
 * Mapeia joystick (-1..1) para deslocamento no chao + giro.
 * jx>0 = direita, jy>0 = frente (tela). Retorna deltas em metros + rad.
 */
export function mapearJoystickParaMovimento(jx, jy, { velocidade = 2.0, giro = 2.4, dt = 1 / 60 } = {}) {
  const { x, y } = aplicarZonaMorta(fixar(jx, -1, 1), fixar(jy, -1, 1));
  return {
    dx: x * velocidade * dt,
    dz: -y * velocidade * dt, // frente da cena e -Z
    giroY: -x * giro * dt,
  };
}

/** Normaliza leitura bruta de gamepad (eixos podem passar de 1). */
export function normalizarEixoGamepad(n) {
  if (!Number.isFinite(n)) return 0;
  return fixar(n, -1, 1);
}
