uniform sampler2D texture1;
uniform sampler2D textures[4];
uniform float grassMinHeight; // Radial distance below which grass disappears

varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vColor;
varying float vWorldY; // This is now distance from planet center

void main() {
  // For spherical terrain, grassMinHeight is relative to planet radius
  // vWorldY is the distance from center, so we compare against minimum radius
  // (This check is now handled in JS, but keep for safety)
  
  float contrast = 1.5;
  float brightness = 0.1;
  vec3 color = texture2D(textures[0], vUv).rgb * contrast;
  color = color + vec3(brightness, brightness, brightness);
  color = mix(color, texture2D(textures[1], cloudUV).rgb, 0.4);
  
  gl_FragColor.rgb = color;
  gl_FragColor.a = 1.0;
}
