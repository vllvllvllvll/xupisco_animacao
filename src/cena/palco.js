import * as THREE from 'three';
import { cssParaScissor } from './viewports.js';

export function initPalco(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10131a);

  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x1a1d24, 0.9));
  const sol = new THREE.DirectionalLight(0xffffff, 1.6);
  sol.position.set(4, 7, 5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  scene.add(sol);
  const rim = new THREE.DirectionalLight(0x88aaff, 0.5);
  rim.position.set(-5, 3, -4);
  scene.add(rim);

  const chao = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({ color: 0x1b2130, roughness: 0.95 }),
  );
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  scene.add(chao);
  const grade = new THREE.GridHelper(12, 24, 0x3a4666, 0x242c44);
  grade.position.y = 0.002;
  scene.add(grade);
  scene.add(new THREE.AxesHelper(0.6));

  const mkCam = () => new THREE.PerspectiveCamera(42, 1, 0.05, 100);
  const camFrente = mkCam(); camFrente.name = 'frente';
  const camCima = mkCam(); camCima.name = 'cima';
  const camLateral = mkCam(); camLateral.name = 'lateral';
  camCima.up.set(0, 0, -1);

  function enquadrar(alvo) {
    camFrente.position.set(alvo.x, alvo.y + 0.35, alvo.z + 4.4);
    camFrente.lookAt(alvo.x, alvo.y, alvo.z);
    camCima.position.set(alvo.x, alvo.y + 6.2, alvo.z + 0.02);
    camCima.lookAt(alvo.x, alvo.y, alvo.z);
    camLateral.position.set(alvo.x + 4.4, alvo.y + 0.35, alvo.z);
    camLateral.lookAt(alvo.x, alvo.y, alvo.z);
  }

  function render(viewports, alvo) {
    const largura = canvas.clientWidth || canvas.width;
    const altura = canvas.clientHeight || canvas.height;
    if (canvas.width !== Math.floor(largura) || canvas.height !== Math.floor(altura)) {
      renderer.setSize(largura, altura, false);
    }
    enquadrar(alvo);
    renderer.setScissorTest(true);
    const pares = [
      [viewports.frente, camFrente],
      [viewports.cima, camCima],
      [viewports.lateral, camLateral],
    ];
    for (const [rect, cam] of pares) {
      const s = cssParaScissor(rect, altura);
      cam.aspect = rect.w / Math.max(1, rect.h);
      cam.updateProjectionMatrix();
      renderer.setViewport(s.x, s.y, s.w, s.h);
      renderer.setScissor(s.x, s.y, s.w, s.h);
      renderer.render(scene, cam);
    }
    renderer.setScissorTest(false);
  }

  return { scene, renderer, cameras: { frente: camFrente, cima: camCima, lateral: camLateral }, render };
}
