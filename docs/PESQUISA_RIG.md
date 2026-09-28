# Pesquisa: rig, IK e animação (resumo aplicado)

Data: 2026-09-27. Fontes: docs three.js (`Skeleton`, `Bone`, `CCDIKHelper`),
manual three.js (câmeras/scissor, múltiplas cenas), `THREE.IK` (FABRIK),
`three-gamepad-controls` (Gamepad API), ozz-animation (IK 2 ossos: alvo + polo + soften).

## Decisões

1. **Rig em 3 camadas** (meshes / bones / controladores), como no Blender/Maya:
   meshes parentadas aos bones; controladores são objetos geométricos simples
   (anel, esfera, octaedro) que o animador move; bones seguem via FK direta ou IK.
2. **Hierarquia PT-BR** com raiz na `cintura` (quadril). Tronco sobe
   (barriga → peito → pescoço → cabeça); membros saem do peito (braços) e da
   cintura (pernas). Espelha convenção de DCCs (hips = root).
3. **IK analítico de 2 ossos** em vez de CCD/FABRIK iterativo:
   - Exato em 1 passada, O(1), sem iteração nem tolerância.
   - Entradas: origem, compA, compB, alvo, polo (direção do cotovelo/joelho).
   - Saídas: alvo limitado ao alcance, posição da junta média, ângulos.
   - Aplicação: `quaternion.setFromUnitVectors(-Y, dir)` convertido p/ espaço local.
   - Limitação conhecida: perde o "twist" (rolamento) — aceitável p/ v1;
     evoluir p/ swing-twist (tipo p0qp0q-IK) se precisar de limites anatômicos.
4. **Multi-viewport com 1 renderer + scissor** (manual three.js):
   evita múltiplos contextos WebGL; cada vista tem sua câmera fixa que dá
   `lookAt` na cintura (tracking). Cima usa `up = (0,0,-1)`.
5. **Entrada unificada**: joystick virtual → Gamepad → teclado, mesma função
   `mapearJoystickParaMovimento` (zona morta 0.12/0.15, clamp ±4 m).
6. **Marcha procedural** movendo os *alvos* (não os bones): exercita o IK de
   verdade e mantém pés/mãos coerentes; amplitude escala com o joystick.

## Alternativas descartadas

- `three-ik` (FABRIK): iterativo, overkill p/ cadeias de 2 ossos; dependência extra.
- `CCDIKSolver` + `SkinnedMesh`: exige skinning (pesos por vértice); nosso
  personagem é de primitivas rígidas parentadas — mais simples e legível.
- 3 canvas/3 renderers: estoura limite de contextos e triplica custo.
