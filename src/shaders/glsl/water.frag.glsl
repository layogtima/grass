uniform vec3 waterColor;
varying float vElevation;
varying vec3 vPosition;

void main() {
  // Approximate surface normal using derivatives
  vec3 x = dFdx(vPosition);
  vec3 y = dFdy(vPosition);
  vec3 normal = normalize(cross(x, y));
  
  // Basic lighting
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.0));
  float diffuse = max(dot(normal, lightDir), 0.0);
  
  // Specular highlight (fake sun reflection)
  vec3 viewDir = normalize(cameraPosition - vPosition); // cameraPosition is uniform by default in Three.js
  vec3 reflectDir = reflect(-lightDir, normal);
  float specular = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
  
  // Color mixing
  vec3 color = waterColor;
  
  // Darker in troughs, lighter on peaks
  color = mix(color * 0.8, color * 1.2, smoothstep(-0.5, 0.5, vElevation));
  
  // Add lighting
  color *= (0.8 + diffuse * 0.2);
  color += vec3(1.0) * specular * 0.5;
  
  // Circular clipping (radius 30)
  float dist = length(vPosition.xz);
  float alpha = smoothstep(30.0, 28.0, dist) * 0.85; // Fade out at edge
  
  if (alpha < 0.01) discard;
  
  gl_FragColor = vec4(color, alpha);
}
