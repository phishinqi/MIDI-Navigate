import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * 智能修复 MIDI 文本编码
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

    // 3. [FIX] 尝试 Shift-JIS (调高优先级)
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

export function getTrackColorCSS(index, opacity = 1) {
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
