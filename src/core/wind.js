// Shared wind uniform and a material patch that sways instanced foliage.
export const windUniforms = { uWindTime: { value: 0 } };

// strength: metres of sway per metre of height above the instance origin.
export function addWind(material, strength = 0.1, frequency = 1.6) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniforms.uWindTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 wOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #else
            vec3 wOrigin = vec3(0.0);
          #endif
          float wPhase = uWindTime * ${frequency.toFixed(3)} + wOrigin.x * 0.21 + wOrigin.z * 0.17;
          float wBend = max(position.y, 0.0) * ${strength.toFixed(4)};
          float gust = 0.6 + 0.4 * sin(uWindTime * 0.37 + wOrigin.x * 0.013);
          transformed.x += sin(wPhase) * wBend * gust;
          transformed.z += cos(wPhase * 0.83 + 1.3) * wBend * 0.6 * gust;
        }`
      );
  };
  material.customProgramCacheKey = () => `wind-${strength}-${frequency}`;
  return material;
}
