import { normalizarEixoGamepad, aplicarZonaMorta } from './joystick.js';

function lerStick(g, ix, iy) {
  const bx = normalizarEixoGamepad(g.axes[ix] ?? 0);
  const by = normalizarEixoGamepad(g.axes[iy] ?? 0);
  const { x, y } = aplicarZonaMorta(bx, by, 0.15);
  return { x, y: -y, intensidade: Math.hypot(x, y) };
}

/**
 * Le o primeiro gamepad (padrao Xbox).
 * Esquerdo = cintura · direito = bone (seleciona/move) · L1 = eixo · R1 = confirma/modo.
 */
export function lerGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const g of pads) {
    if (g && g.connected) {
      return {
        conectado: true, id: g.id,
        stick: lerStick(g, 0, 1),
        stickR: lerStick(g, 2, 3),
        l1: !!(g.buttons[4]?.pressed),
        r1: !!(g.buttons[5]?.pressed),
        botaoA: !!(g.buttons[0]?.pressed),
        botaoB: !!(g.buttons[1]?.pressed),
      };
    }
  }
  return {
    conectado: false, id: null,
    stick: { x: 0, y: 0, intensidade: 0 },
    stickR: { x: 0, y: 0, intensidade: 0 },
    l1: false, r1: false, botaoA: false, botaoB: false,
  };
}
