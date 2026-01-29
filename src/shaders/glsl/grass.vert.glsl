varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vColor;
varying float vWorldY;
varying vec3 vSurfaceNormal;

uniform float iTime;
uniform vec3 planetCenter;
uniform vec3 moonPosition; // For magnetic pull
uniform float moonInteraction; // 0 to 1 strength

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
  
  // Dynamic Wind Speed (increases with moonInteraction)
  float windSpeedBase = 800.0;
  float windSpeed = windSpeedBase / (1.0 + moonInteraction * 3.0); // Faster when moon is close
  
  // Standard Wind
  float windOffset = sin((iTime / windSpeed) + (uv.x * waveSize));
  
  // MOON PULL EFFECT 🌑
  // Grass tips get pulled towards the moon
  vec3 dirToMoon = normalize(moonPosition - worldPos.xyz);
  // Only affect tips (color.x > 0.6)
  
  if (color.x > 0.6) {
    // Wind
    cpos += windDir * windOffset * tipDistance * (1.0 + moonInteraction * 2.0); // Wilder wind
    
    // Moon Pull (Stretching towards moon)
    cpos += dirToMoon * moonInteraction * 2.0; // Grow 2.0 units towards moon!
    
  } else if (color.x > 0.0) {
    // Lower grass wind
    cpos += windDir * windOffset * centerDistance * (1.0 + moonInteraction);
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
