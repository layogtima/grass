import * as THREE from 'three';

export function createMoon(scene, planetRadius) {
  const moonRadius = 4;
  const orbitDistance = planetRadius + 80;
  
  const geometry = new THREE.SphereBufferGeometry(moonRadius, 32, 32);
  // MeshBasicMaterial is unlit, so it always looks "full" and bright
  const material = new THREE.MeshBasicMaterial({ color: 0xffffee });
  
  const moon = new THREE.Mesh(geometry, material);
  
  // Position
  moon.position.set(orbitDistance, orbitDistance * 0.5, -orbitDistance * 0.5);
  
  scene.add(moon);
  
  return moon;
}
