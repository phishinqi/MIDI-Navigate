// frontend/src/shaders/GridSliceShader.js
import * as THREE from 'three';

export const GridSliceMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uGap: { value: 0.04 },
    uIntensity: { value: 2.5 },
    uGlowFalloff: { value: 0.4 },
  },
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
      
      // Animation optimization: scale + slight Z-retreat on fade
      float scale = 0.8 + 0.2 * vAlpha; 
      vec3 pos = position;
      pos.xy *= scale; 
      
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
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
    uniform float uGlowFalloff;

    // SDF Function: Rounded Box
    float roundedBoxSDF(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
    }

    void main() {
      // 1. Basic Shape SDF (Rounded)
      // Use SDF implies discard for anti-aliasing
      float dist = roundedBoxSDF(vUv - 0.5, vec2(0.48), 0.08);
      
      // Anti-aliased Edge
      // Use fwidth or fixed value
      float edgeAlpha = 1.0 - smoothstep(0.0, 0.015, dist);
      
      if (edgeAlpha <= 0.0) discard;

      // 2. Slicing Logic
      vec3 finalColor = vec3(0.0);
      float gapHalf = uGap * 0.5;
      
      // Calculate split mask (1.0 = show, 0.0 = gap)
      float mask = 1.0;
      
      if (vCount < 1.5) { 
        finalColor = vColorA;
      } else if (vCount < 2.5) { 
        // 2-Split: Left/Right
        float splitDist = abs(vUv.x - 0.5);
        mask *= smoothstep(gapHalf, gapHalf + 0.01, splitDist);
        finalColor = (vUv.x < 0.5) ? vColorA : vColorB;
      } else if (vCount < 3.5) {
        // 3-Split: Three columns
        float d1 = abs(vUv.x - 0.33);
        float d2 = abs(vUv.x - 0.66);
        mask *= smoothstep(gapHalf * 0.8, gapHalf * 0.8 + 0.01, d1);
        mask *= smoothstep(gapHalf * 0.8, gapHalf * 0.8 + 0.01, d2);
        
        if (vUv.x < 0.33) finalColor = vColorA;
        else if (vUv.x < 0.66) finalColor = vColorB;
        else finalColor = vColorC;
      } else {
        // 4-Split: Grid
        float dx = abs(vUv.x - 0.5);
        float dy = abs(vUv.y - 0.5);
        mask *= smoothstep(gapHalf, gapHalf + 0.01, dx);
        mask *= smoothstep(gapHalf, gapHalf + 0.01, dy);
        
        if (vUv.x < 0.5 && vUv.y > 0.5) finalColor = vColorA;       // TL
        else if (vUv.x >= 0.5 && vUv.y > 0.5) finalColor = vColorB; // TR
        else if (vUv.x < 0.5 && vUv.y <= 0.5) finalColor = vColorC; // BL
        else finalColor = vColorD;                                  // BR
      }

      // Discard gaps
      if (mask <= 0.01) discard;

      // 3. Internal Glow
      // Calculate distance field from center
      // dist range approx -0.5 (center) to 0.0 (edge)
      float innerGlow = 1.0 - smoothstep(-0.5, 0.0, dist) * uGlowFalloff;
      
      // Rim Light
      float rim = smoothstep(-0.02, 0.0, dist) * 0.5;
      
      vec3 displayColor = finalColor * (innerGlow + rim);

      // 4. Final Output
      // Color * Intensity * Mask * Alpha
      gl_FragColor = vec4(displayColor * uIntensity, vAlpha * edgeAlpha * mask);
    }
  `,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  toneMapped: false
});