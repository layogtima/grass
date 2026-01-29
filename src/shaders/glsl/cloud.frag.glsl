uniform sampler2D cloudTexture;
uniform float opacity;
uniform vec3 moonPosition;
uniform float dayFactor; // 1 = Day, 0 = Night
uniform float isRainy;

varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
  vec4 texColor = texture2D(cloudTexture, vUv);
  
  // Convert to grayscale to determine cloud density
  float gray = (texColor.r + texColor.g + texColor.b) / 3.0;
  
  // Invert and use as alpha
  float cloudAlpha = 1.0 - gray;
  cloudAlpha = smoothstep(0.1, 0.6, cloudAlpha);
  cloudAlpha *= opacity;
  
  // Lighting Logic
  // 1. Day Lighting (Ambient + Sun): Evenly lit, slightly brighter on top? 
  vec3 sunColor = vec3(1.0, 1.0, 1.0); // Standard cloud white
  
  // 2. Night/Moon Lighting: Directional
  vec3 normPos = normalize(vWorldPosition);
  vec3 normMoon = normalize(moonPosition);
  float moonDot = dot(normPos, normMoon); // 1 = Facing moon, -1 = Opposite
  
  // Moon Light Intensity
  // Clouds facing moon get light, backside gets dark, but NOT PITCH BLACK
  float moonLightFactor = smoothstep(-0.2, 0.5, moonDot); 
  
  vec3 ambientNight = vec3(0.05, 0.05, 0.1); // Base night glow
  vec3 moonDirect = vec3(0.6, 0.7, 1.0) * moonLightFactor * 2.0;
  vec3 moonColor = ambientNight + moonDirect;
  
  // Final Color Mix based on Day Factor
  // Normal Mode: Pure White. Rain Mode: Dark Grey/Black
  vec3 baseCloudColor = mix(vec3(1.0), vec3(0.05, 0.05, 0.1), isRainy);
  
  // Use baseCloudColor instead of sunColor
  sunColor = baseCloudColor; 
  
  // Mix
  vec3 finalColor = mix(moonColor, sunColor, dayFactor);
  
  // [Debug/Safety] If dayFactor is high, ensure we don't get dark artifacts
  // unless it is Rain Mode!
  if (isRainy < 0.5) {
      finalColor = max(finalColor, vec3(dayFactor * 0.8)); // Force white in day
  }
  
  gl_FragColor = vec4(finalColor, cloudAlpha);
}
