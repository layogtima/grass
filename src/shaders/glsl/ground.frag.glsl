uniform sampler2D cloudTexture;
uniform vec3 groundColor;
uniform float iTime;
uniform float planetRadius;

varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  // Calculate height above base planet surface
  float distFromCenter = length(vWorldPosition);
  float elevation = distFromCenter - planetRadius;
  float normalizedElevation = elevation / 3.0; // Normalize to roughly -1 to 1 range
  
  // Biome colors based on elevation
  vec3 valleyColor = vec3(0.2, 0.5, 0.15);      // Deep green valleys
  vec3 lowlandColor = vec3(0.3, 0.6, 0.2);      // Lush green lowlands
  vec3 hillColor = vec3(0.4, 0.55, 0.25);       // Yellow-green hills
  vec3 mountainColor = vec3(0.35, 0.45, 0.3);   // Darker mountain green
  vec3 peakColor = vec3(0.5, 0.55, 0.5);        // Rocky gray-green
  vec3 snowColor = vec3(0.95, 0.97, 1.0);       // Snow white
  
  vec3 color;
  
  if (normalizedElevation < -0.3) {
    // Deep valleys - rich green
    color = valleyColor;
  } else if (normalizedElevation < 0.0) {
    // Lowlands - blend valley to lowland
    float t = (normalizedElevation + 0.3) / 0.3;
    color = mix(valleyColor, lowlandColor, t);
  } else if (normalizedElevation < 0.3) {
    // Hills - blend lowland to hill
    float t = normalizedElevation / 0.3;
    color = mix(lowlandColor, hillColor, t);
  } else if (normalizedElevation < 0.6) {
    // Mountains - blend hill to mountain
    float t = (normalizedElevation - 0.3) / 0.3;
    color = mix(hillColor, mountainColor, t);
  } else if (normalizedElevation < 0.85) {
    // High peaks - blend mountain to rocky
    float t = (normalizedElevation - 0.6) / 0.25;
    color = mix(mountainColor, peakColor, t);
  } else {
    // Snow caps!
    float t = clamp((normalizedElevation - 0.85) / 0.15, 0.0, 1.0);
    color = mix(peakColor, snowColor, t);
  }
  
  // Simple diffuse lighting
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
  float diffuse = max(dot(vNormal, lightDir), 0.0);
  color *= 0.6 + diffuse * 0.5;
  
  // Mix in cloud shadows (subtle)
  vec3 cloudShadow = texture2D(cloudTexture, cloudUV).rgb;
  color = mix(color, color * cloudShadow, 0.25);
  
  gl_FragColor.rgb = color;
  gl_FragColor.a = 1.0;
}
