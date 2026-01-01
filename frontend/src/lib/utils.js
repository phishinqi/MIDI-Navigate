// frontend\src\lib\utils.js
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * 修复逻辑：
 * 1. 将乱码字符串回退为原始字节 (假设是 Latin1 误读)
 * 2. 探测顺序调整为：UTF-8 -> Shift-JIS -> GBK
 *    (Shift-JIS 必须在 GBK 之前，否则日文会被误判为生僻汉字)
 * 3. 使用 {fatal: true} 确保只有完全匹配编码格式时才返回
 */
export function fixEncoding(str) {
  if (!str) return "Untitled";

  // 如果没有高位字节，说明是纯 ASCII，直接返回
  // eslint-disable-next-line no-control-regex
  const hasHighBytes = /[\u0080-\u00FF]/.test(str);
  if (!hasHighBytes) return str;

  try {
    // 1. 回退为原始字节
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xFF;
    }

    // 2. 尝试 UTF-8 (最严格，优先解决 "大号" 等现代文件)
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      return decoder.decode(bytes);
    } catch (e) {
      // 不是 UTF-8，继续尝试
    }

    // 3. 尝试 Shift-JIS (调高优先级)
    // 解决 "僄儗..." (Electric Guitar) 等日文乱码
    try {
      const decoder = new TextDecoder('shift-jis', { fatal: true });
      return decoder.decode(bytes);
    } catch (e) {
      // 不是 Shift-JIS
    }

    // 4. 尝试 GBK (中文常见)
    try {
      const decoder = new TextDecoder('gbk', { fatal: true });
      return decoder.decode(bytes);
    } catch (e) {
      // 不是 GBK
    }

    // 5. 都失败了，返回原始字符串 (Latin1)
    return str;

  } catch (e) {
    return str;
  }
}

export function getTrackHue(index) {
  return (index * 137.5 + 20) % 360;
}

/**
 * 获取轨道颜色 (支持自定义颜色)
 * @param {number} index - 轨道索引
 * @param {object} trackColors - 自定义颜色映射 {trackIndex: hexColor}
 * @param {boolean} useDefault - 是否使用默认颜色
 * @returns {string} hex格式颜色
 */
export function getTrackColor(index, trackColors = {}, useDefault = true) {
  if (!useDefault && trackColors[index]) {
    return trackColors[index];
  }
  const hue = getTrackHue(index);
  return hslToHex(hue, 70, 60);
}

/**
 * 将HSL转换为Hex颜色
 * @param {number} h - 色相 (0-360)
 * @param {number} s - 饱和度 (0-100)
 * @param {number} l - 亮度 (0-100)
 * @returns {string} hex格式颜色
 */
export function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }
  const toHex = (val) => {
    const hex = Math.round((val + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getTrackColorCSS(index, opacity = 1, trackColors = {}, useDefault = true) {
  if (!useDefault && trackColors[index]) {
    const hex = trackColors[index];
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  const hue = getTrackHue(index);
  return `hsla(${hue}, 70%, 60%, ${opacity})`;
}

export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

export function isLightColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const brightness = Math.sqrt(
    0.299 * (r * r) +
    0.587 * (g * g) +
    0.114 * (b * b)
  );
  return brightness > 127.5;
}
