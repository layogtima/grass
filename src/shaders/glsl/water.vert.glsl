uniform float iTime;
varying vec2 vUv;
varying vec3 vPosition;
varying float vElevation;

void main() {
  vUv = uv;
  vec3 pos = position;
  
  // "Physics" - sum of sine waves
  // Wave 1: Large rolling swell
  float w1 = sin(pos.x * 0.1 + iTime * 0.8) * 0.3;
  
  // Wave 2: Cross chop
  float w2 = cos(pos.z * 0.2 + iTime * 1.2) * 0.2;
  
  // Wave 3: Small surface detail
  float w3 = sin((pos.x + pos.z) * 0.5 + iTime * 2.0) * 0.1;
  
  float elevation = w1 + w2 + w3;
  
  pos.y += elevation;
  vElevation = elevation;
  vPosition = pos;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
