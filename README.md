# Xupisco Animação

Web app Three.js: humanoide rigado, painel de 3 câmeras
(frente / cima / lateral), joystick virtual na tela + Gamepad API real.

## Modelo

- **Xbot** (`public/modelo-xbot.glb`, do repo three.js): humanoide rigado
  Mixamo, 67 joints, pesos verificados (0 orfãos). O retarget copia a
  rotacao-relativa-ao-repouso dos nossos bones PT-BR p/ os dele todo frame —
  IK, controladores e timeline continuam iguais. Botão "modelo" alterna
  entre Xbot e as primitivas de fallback.
- **Backup:** branch `backup-primitivas` tem a versão só com primitivas.

Web app Three.js: personagem rigado com nomenclatura em português, painel de 3 câmeras
(frente / cima / lateral), joystick virtual na tela + Gamepad API real.

## Rodar

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # testes de lógica (node:test)
npm run build   # gera dist/
```

## Rig: meshes + bones + controladores

- **Raiz / controlador principal:** `cintura`
- Tronco: `cintura → barriga → peito → pescoco → cabeca`
- Braços (E/D): `ombro → braco → antebraco → mao` (a ordem anatômica correta;
  o pedido citava "ombros, antebraço, braço e mão" mas antebraço vem depois do braço)
- Pernas (E/D): `coxa → perna → pe`
- **Meshes:** cápsulas/esferas/caixas parentadas a cada bone, cor por segmento.
- **Bones:** `THREE.Bone` com `SkeletonHelper` para visualização.
- **Controladores (curvas/primitivas):** anéis torus (`ctrl_cintura/barriga/peito/cabeca`),
  esferas wireframe (alvos IK `alvo_mao_E/D`, `alvo_pe_E/D`) e octaedros
  (polos `polo_cotovelo_E/D`, `polo_joelho_E/D`).
- **IK:** solver analítico de 2 ossos (lei dos cossenos) em `src/rig/ik.js`
  + aplicação via `setFromUnitVectors` (eixo −Y local → direção mundo).
  Referências: docs `THREE.Skeleton`/`THREE.Bone`, técnica FABRIK/CCD
  (usamos analítico por ser exato para 2 ossos e barato por frame).

## Painel / câmeras

Um único `WebGLRenderer` com scissor: esquerda = frente, direita-cima = cima,
direita-baixo = lateral (ver `src/cena/viewports.js`). Padrão do manual
three.js "multiple scenes / scissor".

## Controles (so controladores — bones ficam escondidos)

- Joystick virtual esquerdo / stick esquerdo do gamepad: move o controlador
  selecionado no eixo ativo (X vermelho, Y verde, Z azul, padrao Blender).
- Joystick virtual direito / stick direito: navega a lista de controladores.
- L1 (tela ou gamepad): cicla o eixo; R1: confirma (selecao ↔ mover).
- Controladores: `ctrl_cintura` (move o boneco), alvos IK das maos/pes e polos.
- O selecionado pulsa (1.3x); a seta do eixo aparece enquanto move.
- WASD foi removido; setas movem o controlador selecionado, R = repouso.
