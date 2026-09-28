/** Timeline de poses: pura e testavel. Tempo em segundos, poses em {nome:{r:[x,y,z],p:[x,y,z]}}. */

export function extrairPose(bones) {
  const pose = {};
  for (const n of Object.keys(bones)) {
    const b = bones[n];
    pose[n] = { r: [b.rotation.x, b.rotation.y, b.rotation.z], p: [b.position.x, b.position.y, b.position.z] };
  }
  return pose;
}

export function aplicarPose(bones, pose) {
  for (const n of Object.keys(pose)) {
    if (!bones[n]) continue;
    bones[n].rotation.set(...pose[n].r);
    bones[n].position.set(...pose[n].p);
  }
}

const lerp = (a, b, t) => a + (b - a) * t;

export function interpolarPoses(a, b, t) {
  const out = {};
  for (const n of Object.keys(a)) {
    if (!b[n]) continue;
    out[n] = {
      r: a[n].r.map((v, i) => lerp(v, b[n].r[i], t)),
      p: a[n].p.map((v, i) => lerp(v, b[n].p[i], t)),
    };
  }
  return out;
}

/**
 * Amostra a timeline em loop. keys: [{t, pose}] ordenadas.
 * @returns {{pose, anterior, proxima} | null} (anterior/proxima p/ onion skin)
 */
export function amostrar(keys, tempo) {
  if (!keys.length) return null;
  const ks = [...keys].sort((a, b) => a.t - b.t);
  if (ks.length === 1 || tempo <= ks[0].t) {
    return { pose: ks[0].pose, anterior: ks[ks.length - 1].pose, proxima: ks[Math.min(1, ks.length - 1)].pose };
  }
  const dur = ks[ks.length - 1].t;
  const t = dur > 0 ? tempo % dur : 0;
  for (let i = 0; i < ks.length - 1; i++) {
    if (t >= ks[i].t && t <= ks[i + 1].t) {
      const span = ks[i + 1].t - ks[i].t;
      const k = span > 0 ? (t - ks[i].t) / span : 0;
      return { pose: interpolarPoses(ks[i].pose, ks[i + 1].pose, k), anterior: ks[i].pose, proxima: ks[i + 1].pose };
    }
  }
  return { pose: ks[ks.length - 1].pose, anterior: ks[ks.length - 2]?.pose ?? ks[0].pose, proxima: ks[0].pose };
}

/** Quadro atual p/ o contador (fps muda a granularidade exibida). */
export function quadroAtual(tempo, fps) {
  return Math.floor(Math.max(0, tempo) * fps);
}
