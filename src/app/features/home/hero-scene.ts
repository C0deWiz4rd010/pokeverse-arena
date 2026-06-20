import * as THREE from 'three';

/**
 * Lazily-imported Three.js hero: a holographic Poke Ball energy core made of an
 * inner icosahedron, a glowing wireframe shell and an orbiting particle field.
 * Reacts subtly to pointer movement. Returns a disposer that fully tears down
 * the renderer, geometries and listeners.
 */
export function createHeroScene(canvas: HTMLCanvasElement): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 4.2;

  const group = new THREE.Group();
  scene.add(group);

  // Inner solid core
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x6ce0ff,
      emissive: 0x1b2a6b,
      metalness: 0.7,
      roughness: 0.2,
      flatShading: true,
    }),
  );
  group.add(core);

  // Glowing wireframe shell
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.55, 1),
    new THREE.MeshBasicMaterial({ color: 0xc46bff, wireframe: true, transparent: true, opacity: 0.4 }),
  );
  group.add(shell);

  // Orbiting particle field
  const count = 700;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 2 + Math.random() * 2.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({ color: 0xffd166, size: 0.03, transparent: true, opacity: 0.8 }),
  );
  scene.add(particles);

  const keyLight = new THREE.PointLight(0x6ce0ff, 60, 50);
  keyLight.position.set(4, 3, 5);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(0xc46bff, 40, 50);
  rimLight.position.set(-4, -2, 2);
  scene.add(rimLight);
  scene.add(new THREE.AmbientLight(0x404060, 1.2));

  const pointer = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer);

  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let raf = 0;
  const clock = new THREE.Clock();
  const animate = () => {
    const t = clock.getElapsedTime();
    group.rotation.y = t * 0.4 + pointer.x * 0.6;
    group.rotation.x = Math.sin(t * 0.3) * 0.2 + pointer.y * 0.4;
    shell.rotation.z = t * 0.1;
    particles.rotation.y = -t * 0.05;
    const pulse = 1 + Math.sin(t * 2) * 0.03;
    core.scale.setScalar(pulse);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  };
  animate();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('pointermove', onPointer);
    core.geometry.dispose();
    (core.material as THREE.Material).dispose();
    shell.geometry.dispose();
    (shell.material as THREE.Material).dispose();
    particleGeo.dispose();
    (particles.material as THREE.Material).dispose();
    renderer.dispose();
  };
}
