/**
 * Verificacao/correcao de pintura de pesos p/ SkinnedMesh.
 * Opera nos atributos brutos (testavel sem renderer nem GLTF).
 * @param {{count:number, skinIndex:{array:number[]}, skinWeight:{array:number[]}}} geo
 * @returns {{total:number, orfaos:number, normalizados:number, somaMax:number}}
 */
export function verificarENormalizarPesos(geo) {
  const { count, skinIndex, skinWeight } = geo;
  const si = skinIndex.array, sw = skinWeight.array;
  let orfaos = 0, normalizados = 0, somaMax = 0;
  for (let v = 0; v < count; v++) {
    let soma = 0;
    for (let k = 0; k < 4; k++) soma += sw[v * 4 + k];
    somaMax = Math.max(somaMax, soma);
    if (soma <= 1e-9) { orfaos++; continue; } // sem influencia: so reporta
    if (Math.abs(soma - 1) > 1e-4) {
      for (let k = 0; k < 4; k++) sw[v * 4 + k] /= soma;
      normalizados++;
    }
  }
  return { total: count, orfaos, normalizados, somaMax };
}
