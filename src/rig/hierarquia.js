/**
 * Hierarquia do rig em portugues — fonte unica de verdade.
 *
 * Estrutura:
 * cintura (raiz / controlador principal)
 * ├─ barriga
 * │  └─ peito
 * │     ├─ pescoco → cabeca
 * │     ├─ ombro_E → braco_E → antebraco_E → mao_E
 * │     └─ ombro_D → braco_D → antebraco_D → mao_D
 * ├─ coxa_E → perna_E → pe_E
 * └─ coxa_D → perna_D → pe_D
 */

export const HIERARQUIA = {
  cintura: {
    barriga: {
      peito: {
        pescoco: { cabeca: {} },
        ombro_E: { braco_E: { antebraco_E: { mao_E: {} } } },
        ombro_D: { braco_D: { antebraco_D: { mao_D: {} } } },
      },
    },
    coxa_E: { perna_E: { pe_E: {} } },
    coxa_D: { perna_D: { pe_D: {} } },
  },
};

export const RAIZ = 'cintura';

/** Cadeias IK (2 ossos + efetor). Nomes em portugues. */
export const CADEIAS_IK = [
  { nome: 'braco_E', raiz: 'ombro_E', meio: 'braco_E', efetor: 'mao_E', alvo: 'alvo_mao_E', polo: 'polo_cotovelo_E' },
  { nome: 'braco_D', raiz: 'ombro_D', meio: 'braco_D', efetor: 'mao_D', alvo: 'alvo_mao_D', polo: 'polo_cotovelo_D' },
  { nome: 'perna_E', raiz: 'coxa_E', meio: 'perna_E', efetor: 'pe_E', alvo: 'alvo_pe_E', polo: 'polo_joelho_E' },
  { nome: 'perna_D', raiz: 'coxa_D', meio: 'perna_D', efetor: 'pe_D', alvo: 'alvo_pe_D', polo: 'polo_joelho_D' },
];

/** Controladores (curvas/primitivas geometricas) — um por junta + alvos IK. */
export const CONTROLADORES = [
  'ctrl_cintura',
  'ctrl_barriga',
  'ctrl_peito',
  'ctrl_pescoco',
  'ctrl_cabeca',
  'ctrl_ombro_E',
  'ctrl_ombro_D',
  'alvo_mao_E',
  'alvo_mao_D',
  'alvo_pe_E',
  'alvo_pe_D',
  'polo_cotovelo_E',
  'polo_cotovelo_D',
  'polo_joelho_E',
  'polo_joelho_D',
];

function percorrer(no, visita, pai = null) {
  for (const nome of Object.keys(no)) {
    visita(nome, pai);
    percorrer(no[nome], visita, nome);
  }
}

/** Lista todos os bones em profundidade (ordenzinho estavel). */
export function listarBones(hierarquia = HIERARQUIA) {
  const nomes = [];
  percorrer(hierarquia, (nome) => nomes.push(nome));
  return nomes;
}

/** Mapa bone → pai (raiz tem pai null). */
export function mapaDePais(hierarquia = HIERARQUIA) {
  const mapa = {};
  percorrer(hierarquia, (nome, pai) => { mapa[nome] = pai; });
  return mapa;
}

/** Valida a hierarquia: raiz unica, nomes unicos, cadeias IK existentes. */
export function validarHierarquia(hierarquia = HIERARQUIA) {
  const erros = [];
  const raizes = Object.keys(hierarquia);
  if (raizes.length !== 1 || raizes[0] !== RAIZ) {
    erros.push(`raiz deve ser unica e chamar '${RAIZ}', encontrado: [${raizes.join(', ')}]`);
  }
  const nomes = listarBones(hierarquia);
  const unicos = new Set(nomes);
  if (unicos.size !== nomes.length) erros.push('nomes de bones duplicados');
  const tem = (n) => unicos.has(n);
  if (!tem('cintura')) erros.push('falta cintura');
  if (!tem('barriga')) erros.push('falta barriga');
  if (!tem('peito')) erros.push('falta peito');
  if (!tem('pescoco') || !tem('cabeca')) erros.push('falta pescoco/cabeca');
  for (const lado of ['E', 'D']) {
    for (const b of [`ombro_${lado}`, `braco_${lado}`, `antebraco_${lado}`, `mao_${lado}`, `coxa_${lado}`, `perna_${lado}`, `pe_${lado}`]) {
      if (!tem(b)) erros.push(`falta ${b}`);
    }
  }
  const mapa = mapaDePais(hierarquia);
  const esperaPai = (filho, pai) => {
    if (mapa[filho] !== pai) erros.push(`${filho} deveria ser filho de ${pai}, e sim de ${mapa[filho]}`);
  };
  if (tem('barriga')) esperaPai('barriga', 'cintura');
  if (tem('peito')) esperaPai('peito', 'barriga');
  if (tem('pescoco')) esperaPai('pescoco', 'peito');
  if (tem('cabeca')) esperaPai('cabeca', 'pescoco');
  for (const lado of ['E', 'D']) {
    esperaPai(`ombro_${lado}`, 'peito');
    esperaPai(`braco_${lado}`, `ombro_${lado}`);
    esperaPai(`antebraco_${lado}`, `braco_${lado}`);
    esperaPai(`mao_${lado}`, `antebraco_${lado}`);
    esperaPai(`coxa_${lado}`, 'cintura');
    esperaPai(`perna_${lado}`, `coxa_${lado}`);
    esperaPai(`pe_${lado}`, `perna_${lado}`);
  }
  for (const c of CADEIAS_IK) {
    for (const k of ['raiz', 'meio', 'efetor']) {
      if (!tem(c[k])) erros.push(`cadeia IK ${c.nome}: falta bone ${c[k]}`);
    }
  }
  return { ok: erros.length === 0, erros, totalBones: nomes.length };
}
