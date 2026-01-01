// frontend/src/shaders/GridSliceShader.js
import * as THREE from 'three';

export const GridSliceMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uGap: { value: 0.04 },      // 缝隙宽度
    uIntensity: { value: 2.5 }, // 基础发光强度
    uGlowFalloff: { value: 0.4 }, // 内部光衰减程度 (0.0=纯平, 1.0=很强的中心光)
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
      
      // 动画优化：不只是缩放，淡出时稍微往后退一点点 (Z轴)，增加层次感
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

    // SDF 函数：计算点到圆角矩形的距离
    float roundedBoxSDF(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
    }

    void main() {
      // 1. 基础形状 SDF (带圆角)
      // 使用 SDF 而不是直接 discard，是为了做抗锯齿
      float dist = roundedBoxSDF(vUv - 0.5, vec2(0.48), 0.08);
      
      // 抗锯齿边缘 (Anti-aliased Edge)
      // 使用 fwidth 自适应屏幕分辨率，或固定值 0.01
      float edgeAlpha = 1.0 - smoothstep(0.0, 0.015, dist);
      
      if (edgeAlpha <= 0.0) discard;

      // 2. 切割逻辑 (Slicing Logic)
      vec3 finalColor = vec3(0.0);
      float gapHalf = uGap * 0.5;
      
      // 计算切割线的遮罩 (1.0 = 显示, 0.0 = 缝隙)
      float mask = 1.0;
      
      if (vCount < 1.5) { 
        finalColor = vColorA;
      } else if (vCount < 2.5) { 
        // 2分: 左右切
        float splitDist = abs(vUv.x - 0.5);
        mask *= smoothstep(gapHalf, gapHalf + 0.01, splitDist);
        finalColor = (vUv.x < 0.5) ? vColorA : vColorB;
      } else if (vCount < 3.5) {
        // 3分: 三竖条
        float d1 = abs(vUv.x - 0.33);
        float d2 = abs(vUv.x - 0.66);
        mask *= smoothstep(gapHalf * 0.8, gapHalf * 0.8 + 0.01, d1);
        mask *= smoothstep(gapHalf * 0.8, gapHalf * 0.8 + 0.01, d2);
        
        if (vUv.x < 0.33) finalColor = vColorA;
        else if (vUv.x < 0.66) finalColor = vColorB;
        else finalColor = vColorC;
      } else {
        // 4分: 田字格
        float dx = abs(vUv.x - 0.5);
        float dy = abs(vUv.y - 0.5);
        mask *= smoothstep(gapHalf, gapHalf + 0.01, dx);
        mask *= smoothstep(gapHalf, gapHalf + 0.01, dy);
        
        if (vUv.x < 0.5 && vUv.y > 0.5) finalColor = vColorA;       // 左上
        else if (vUv.x >= 0.5 && vUv.y > 0.5) finalColor = vColorB; // 右上
        else if (vUv.x < 0.5 && vUv.y <= 0.5) finalColor = vColorC; // 左下
        else finalColor = vColorD;                                  // 右下
      }

      // 如果是缝隙区域，直接透明
      if (mask <= 0.01) discard;

      // 3. 灯箱质感 (Internal Glow)
      // 计算从中心到边缘的距离场，让中心更亮，边缘稍暗
      // dist 范围大约是 -0.5 (中心) 到 0.0 (边缘)
      float innerGlow = 1.0 - smoothstep(-0.5, 0.0, dist) * uGlowFalloff;
      
      // 边缘高光 (Rim Light) - 让轮廓有一圈非常细的亮边
      float rim = smoothstep(-0.02, 0.0, dist) * 0.5;
      
      vec3 displayColor = finalColor * (innerGlow + rim);

      // 4. 最终输出
      // 颜色 * 强度 * 遮罩 * 透明度
      // 注意：这里 mask 用于处理缝隙的抗锯齿
      gl_FragColor = vec4(displayColor * uIntensity, vAlpha * edgeAlpha * mask);
    }
  `,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  toneMapped: false // 关键：关闭色调映射，允许超亮颜色 (HDR) 触发 Bloom
});