import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export function createMoon(scene, planetRadius) {
  const moonGroup = new THREE.Group();
  
  // Initial orbit distance (100x further)
  const orbitDistance = planetRadius + 10000; 
  moonGroup.position.set(orbitDistance, orbitDistance * 0.2, -orbitDistance * 0.2);
  
  scene.add(moonGroup);
  
  // Load the model
  const loader = new GLTFLoader();
  loader.load('assets/models/moon.glb', (gltf) => {
    const model = gltf.scene;
    
    // Scale it UP! Massive!
    const scale = 15; 
    model.scale.set(scale, scale, scale);
    
    // [Fix] Center the geometry to prevent wobbling axis
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center); // Offset by center
    
    model.traverse((child) => {
      if (child.isMesh) {
         // FORCE NEW MATERIAL
         // Discard oldMap because it might be black/broken.
         const oldNormal = child.material.normalMap;
         
         const newMat = new THREE.MeshStandardMaterial({
            map: null, // Discard texture for safety
            normalMap: oldNormal, // Keep bumps if they exist
            color: 0xeeeeff, // Pale moon white
            roughness: 0.9,
            emissive: new THREE.Color(0x5555ff), // Blueish glow
            emissiveIntensity: 0.2, // Base shimmer
            toneMapped: true
         });
         
         child.material = newMat;
         child.castShadow = true;
         child.receiveShadow = true;
      }
    });

    moonGroup.add(model);
    console.log("🌑 Moon Model Loaded!");
  }, undefined, (error) => {
    console.error('Error loading moon:', error);
    // Fallback?
    const geometry = new THREE.SphereBufferGeometry(5, 32, 32);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0xffffee,
      roughness: 0.8,
      bumpScale: 0.5
    });
    const fallback = new THREE.Mesh(geometry, material);
    moonGroup.add(fallback);
  });
  
  return moonGroup;
}
