// frontend/src/shaders/GridSliceShader.js
import * as THREE from 'three';

export const GridSliceMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uGap: { value: 0.05 },
    uIntensity: { value: 1.0 }, // [核心修改] 暴力提升亮度到 4.0
  },
  // ... (vertexShader 保持不变)
  vertexShader: `
    attribute vec3 colorA;
    attribute vec3 colorB;
    attribute vec3 colorC;
    attribute vec3 colorD;
    attribute float count;
    attribute float instanceAlpha;

    varying vec2 vUv;
    varying vec3 vColorA;
    varying vec3 vColorB;
    varying vec3 vColorC;
    varying vec3 vColorD;
    varying float vCount;
    varying float vAlpha;

    void main() {
      vUv = uv;
      vColorA = colorA;
      vColorB = colorB;
      vColorC = colorC;
      vColorD = colorD;
      vCount = count;
      vAlpha = instanceAlpha;
      
      float scale = 0.85 + 0.15 * vAlpha; 
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position * scale, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vColorA;
    varying vec3 vColorB;
    varying vec3 vColorC;
    varying vec3 vColorD;
    varying float vCount;
    varying float vAlpha;
    
    uniform float uGap;
    uniform float uIntensity;

    float roundedBox(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
    }

    void main() {
      float d = roundedBox(vUv - 0.5, vec2(0.48), 0.1);
      if (d > 0.0) discard;

      vec3 finalColor = vec3(0.0);
      float gap = uGap * 0.5;

      if (vCount < 1.5) { 
        finalColor = vColorA;
      } else if (vCount < 2.5) { 
        if (abs(vUv.x - 0.5) < gap) discard;
        finalColor = (vUv.x < 0.5) ? vColorA : vColorB;
      } else if (vCount < 3.5) {
        if (abs(vUv.x - 0.33) < gap * 0.8) discard;
        if (abs(vUv.x - 0.66) < gap * 0.8) discard;
        if (vUv.x < 0.33) finalColor = vColorA;
        else if (vUv.x < 0.66) finalColor = vColorB;
        else finalColor = vColorC;
      } else {
        if (abs(vUv.x - 0.5) < gap) discard;
        if (abs(vUv.y - 0.5) < gap) discard;
        if (vUv.x < 0.5 && vUv.y > 0.5) finalColor = vColorA;
        else if (vUv.x >= 0.5 && vUv.y > 0.5) finalColor = vColorB;
        else if (vUv.x < 0.5 && vUv.y <= 0.5) finalColor = vColorC;
        else finalColor = vColorD;
      }

      if (vCount < 0.5) discard;

      // 暴力输出：颜色 * 4.0，确保即使是深蓝色也能变成亮蓝色
      gl_FragColor = vec4(finalColor * uIntensity, vAlpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  toneMapped: false // 保持关闭
});
