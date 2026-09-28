# Chupisco X Animação

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

## Controles

- Joystick virtual (canto inferior esquerdo) move a **cintura** no plano + gira.
- Gamepad API: stick esquerdo faz o mesmo quando o joystick virtual está parado.
- WASD = mover, setas = mover alvo IK selecionado, R = repouso.
- Sliders FK (RX/RY/RZ) por junta + sliders XYZ por alvo IK.
- Marcha procedural: com "Animar" ligado, os alvos dos pés/mãos oscilam
  em seno (amplitude cresce com o joystick) e a cintura balança.
