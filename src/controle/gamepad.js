import { normalizarEixoGamepad, aplicarZonaMorta } from './joystick.js';

/** Le o primeiro gamepad conectado (padrao Xbox: eixos 0/1 = stick esquerdo). */
export function lerGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const g of pads) {
    if (g && g.connected) {
      const bx = normalizarEixoGamepad(g.axes[0] ?? 0);
      const by = normalizarEixoGamepad(g.axes[1] ?? 0);
      const { x, y } = aplicarZonaMorta(bx, by, 0.15);
      return {
        conectado: true, id: g.id,
        stick: { x, y: -y, intensidade: Math.hypot(x, y) },
        botaoA: !!(g.buttons[0]?.pressed),
        botaoB: !!(g.buttons[1]?.pressed),
      };
    }
  }
  return { conectado: false, id: null, stick: { x: 0, y: 0, intensidade: 0 }, botaoA: false, botaoB: false };
}
