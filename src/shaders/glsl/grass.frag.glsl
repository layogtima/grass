uniform sampler2D texture1;
uniform sampler2D textures[4];
uniform float grassMinHeight; 
uniform float globalLightIntensity; // Moonfall control
uniform vec3 moonPosition;
uniform float dayFactor;

varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vColor;
varying float vWorldY; 
varying vec3 vWorldPosition;

void main() {
  // For spherical terrain, grassMinHeight is relative to planet radius
  // vWorldY is the distance from center, so we compare against minimum radius
  // (This check is now handled in JS, but keep for safety)
  
  float contrast = 1.5;
  float brightness = 0.1;
  vec3 color = texture2D(textures[0], vUv).rgb * contrast;
  color = color + vec3(brightness, brightness, brightness);
  color = mix(color, texture2D(textures[1], cloudUV).rgb, 0.4);
  
  // Moonfall Darkness
  // OLD: color *= globalLightIntensity;
  
  // NEW: Add Directional Moon Light
  vec3 moonDir = normalize(moonPosition - vWorldPosition);
  float ndotl = max(0.0, dot(normalize(vWorldPosition), moonDir)); // Approx Up normal
  
  vec3 moonColor = vec3(0.5, 0.6, 1.0); // Soft Blue
  float moonMix = 1.0 - dayFactor;
  
  // Base Ambient + Directional Moon
  vec3 nightLight = vec3(0.1) + (moonColor * ndotl * 2.0);
  
  // Mix based on dayFactor
  // Day: globalLightIntensity is 1.0. Night: it's 0.05.
  // We want to ADD moon light at night.
  
  color *= (globalLightIntensity + (nightLight * moonMix * 0.5));
  
  gl_FragColor.rgb = color;
  gl_FragColor.a = 1.0;
}
