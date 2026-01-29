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
  vec3 sandColor = vec3(0.93, 0.87, 0.69);      // #eddba6 (Sand)
  vec3 grassColor = vec3(0.32, 0.48, 0.18);     // #517a2e (Grass)
  vec3 rockColor = vec3(0.45, 0.42, 0.40);      // #736b66 (Rock)
  vec3 snowColor = vec3(0.95, 0.97, 1.0);       // #f2f7ff (Snow)
  
  vec3 color;
  
  // Normalized elevation is roughly -1.0 to 1.0
  // Adjust bands for interesting distribution
  
  float sandThresh = -0.2;
  float grassThresh = 0.5;
  float rockThresh = 0.8;

  // Add some noise to transitions (using simple coordinate based dithering for now)
  float noise = sin(vWorldPosition.x * 0.5) * sin(vWorldPosition.y * 0.5) * sin(vWorldPosition.z * 0.5) * 0.05;
  float h = normalizedElevation + noise;

  if (h < sandThresh) {
    // Sand / Beach
    color = sandColor;
  } else if (h < sandThresh + 0.1) {
    // Sand -> Grass Mix
    float t = (h - sandThresh) / 0.1;
    color = mix(sandColor, grassColor, t);
  } else if (h < grassThresh) {
    // Grassland
    color = grassColor;
  } else if (h < grassThresh + 0.2) {
    // Grass -> Rock Mix
    float t = (h - grassThresh) / 0.2;
    color = mix(grassColor, rockColor, t);
  } else if (h < rockThresh) {
    // Rock / Mountain
    color = rockColor;
  } else if (h < rockThresh + 0.15) {
    // Rock -> Snow Mix
    float t = (h - rockThresh) / 0.15;
    color = mix(rockColor, snowColor, t);
  } else {
    // Snow Caps
    color = snowColor;
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
