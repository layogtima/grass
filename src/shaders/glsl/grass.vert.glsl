varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vColor;
varying float vWorldY;
varying vec3 vSurfaceNormal;

uniform float iTime;
uniform vec3 planetCenter;

void main() {
  vUv = uv;
  vColor = color;
  vec3 cpos = position;

  // Calculate surface normal (direction from planet center)
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vSurfaceNormal = normalize(worldPos.xyz - planetCenter);
  
  // REDUCED wind animation - much more subtle now!
  float waveSize = 15.0;        // Slower wave
  float tipDistance = 0.04;     // Much smaller movement (was 0.2)
  float centerDistance = 0.015; // Much smaller (was 0.08)

  // Create a tangent for wind direction
  vec3 windDir = normalize(cross(vSurfaceNormal, vec3(0.0, 1.0, 0.1)));
  
  if (color.x > 0.6) {
    cpos += windDir * sin((iTime / 800.0) + (uv.x * waveSize)) * tipDistance;
  } else if (color.x > 0.0) {
    cpos += windDir * sin((iTime / 800.0) + (uv.x * waveSize)) * centerDistance;
  }

  // Cloud UV from spherical coordinates
  vec3 normPos = normalize(worldPos.xyz);
  float theta = atan(normPos.z, normPos.x);
  float phi = acos(normPos.y);
  cloudUV = vec2(theta / 6.28318 + 0.5, phi / 3.14159);
  cloudUV.x += iTime / 30000.0;  // Slower cloud movement
  cloudUV.y += iTime / 60000.0;

  // Pass world position for effects
  vWorldY = length(worldPos.xyz);

  vec4 mvPosition = projectionMatrix * modelViewMatrix * vec4(cpos, 1.0);
  gl_Position = mvPosition;
}
