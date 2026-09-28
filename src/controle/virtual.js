import { limitarVetor } from './joystick.js';

/**
 * Joystick virtual (toque + mouse). Desenha base + pino via divs.
 * onMove({x, y, intensidade}) com x,y em -1..1 (y+ = cima da tela).
 */
export function initJoystickVirtual(baseEl, pinoEl, onMove) {
  const RAIO = 48;
  let ativo = false;
  let centro = { x: 0, y: 0 };

  function emitir(dx, dy) {
    const l = limitarVetor(dx, dy, RAIO);
    pinoEl.style.transform = `translate(${l.x}px, ${l.y}px)`;
    onMove({ x: l.x / RAIO, y: -l.y / RAIO, intensidade: l.intensidade });
  }

  function inicio(e) {
    ativo = true;
    const r = baseEl.getBoundingClientRect();
    centro = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const p = ponto(e);
    emitir(p.x - centro.x, p.y - centro.y);
    e.preventDefault();
  }
  function mover(e) {
    if (!ativo) return;
    const p = ponto(e);
    emitir(p.x - centro.x, p.y - centro.y);
    e.preventDefault();
  }
  function fim() {
    if (!ativo) return;
    ativo = false;
    pinoEl.style.transform = 'translate(0px, 0px)';
    onMove({ x: 0, y: 0, intensidade: 0 });
  }
  function ponto(e) {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  baseEl.addEventListener('pointerdown', inicio);
  window.addEventListener('pointermove', mover);
  window.addEventListener('pointerup', fim);
  window.addEventListener('pointercancel', fim);
  return { destroy() {
    baseEl.removeEventListener('pointerdown', inicio);
    window.removeEventListener('pointermove', mover);
    window.removeEventListener('pointerup', fim);
    window.removeEventListener('pointercancel', fim);
  } };
}
