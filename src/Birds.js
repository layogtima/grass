import * as THREE from 'three';

export class BirdSwarm {
  constructor(scene, count = 50) {
    this.scene = scene;
    this.count = count;
    
    // Simple bird geometry (Pyramid)
    const geometry = new THREE.ConeBufferGeometry(0.1, 0.4, 3);
    geometry.rotateX(Math.PI / 2); // Point forward
    
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.scene.add(this.mesh);
    
    this.birds = [];
    const dummy = new THREE.Object3D();
    
    // Initialize birds
    for (let i = 0; i < count; i++) {
      // Random position around planet (radius ~25-40)
      const r = 25 + Math.random() * 15;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      this.birds.push({
        position: new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta)
        ),
        velocity: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize().multiplyScalar(0.1),
        phase: Math.random() * 6.28
      });
      
      dummy.position.copy(this.birds[i].position);
      dummy.lookAt(0, 0, 0); // Temporary look
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
  }
  
  update(delta) {
    const dummy = new THREE.Object3D();
    const planetCenter = new THREE.Vector3(0, 0, 0);
    
    for (let i = 0; i < this.count; i++) {
      const bird = this.birds[i];
      
      // Move bird
      bird.position.add(bird.velocity);
      
      // Simple orbital gravity / centering force
      const dist = bird.position.length();
      if (dist > 50) {
        bird.velocity.add(bird.position.clone().negate().normalize().multiplyScalar(0.001));
      } else if (dist < 20) {
        bird.velocity.add(bird.position.clone().normalize().multiplyScalar(0.001));
      }
      
      // Noise/Wander
      bird.velocity.x += (Math.random() - 0.5) * 0.005;
      bird.velocity.y += (Math.random() - 0.5) * 0.005;
      bird.velocity.z += (Math.random() - 0.5) * 0.005;
      bird.velocity.normalize().multiplyScalar(10 * delta); // Speed
      
      // Update Instance
      dummy.position.copy(bird.position);
      
      // Orient bird to face velocity, but keep "up" relative to planet somewhat?
      // Actually just lookAt target + velocity is fine for simple birds
      const target = bird.position.clone().add(bird.velocity);
      dummy.lookAt(target);
      
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
