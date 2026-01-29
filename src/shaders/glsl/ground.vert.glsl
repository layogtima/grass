varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vNormal;
varying vec3 vWorldPosition;

uniform float iTime;
uniform float planetRadius;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  
  // Get world position for cloud shadow calculation
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  
  // Cloud shadow UV based on spherical position
  // Map world position to UV using spherical coordinates
  vec3 normPos = normalize(worldPos.xyz);
  float theta = atan(normPos.z, normPos.x);
  float phi = acos(normPos.y);
  
  cloudUV = vec2(theta / 6.28318 + 0.5, phi / 3.14159);
  cloudUV.x += iTime / 20000.0;
  cloudUV.y += iTime / 40000.0;

  vec4 mvPosition = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = mvPosition;
}
