import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs))
}

export function fixEncoding(str: string) {
  if (!str) return "Untitled";

  const hasHighBytes = /[\u0080-\u00FF]/.test(str);
  if (!hasHighBytes) return str;

  try {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xFF;
    }

    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      return decoder.decode(bytes);
    } catch (e) {
    }

    try {
      const decoder = new TextDecoder('shift-jis', { fatal: true });
      return decoder.decode(bytes);
    } catch (e) {
    }

    try {
      const decoder = new TextDecoder('gbk', { fatal: true });
      return decoder.decode(bytes);
    } catch (e) {
    }

    return str;

  } catch (e) {
    return str;
  }
}

export function getTrackHue(index: number) {
  return (index * 137.5 + 20) % 360;
}

export function getTrackColor(index: number, trackColors: Record<number, string> = {}, useDefault = true) {
  if (!useDefault && trackColors[index]) {
    return trackColors[index];
  }
  const hue = getTrackHue(index);
  return hslToHex(hue, 70, 60);
}

export function hslToHex(h: number, s: number, l: number) {
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
  const toHex = (val: number) => {
    const hex = Math.round((val + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getTrackColorCSS(index: number, opacity = 1, trackColors: Record<number, string> = {}, useDefault = true) {
  if (!useDefault && trackColors[index]) {
    const hex = trackColors[index];
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  const hue = getTrackHue(index);
  return `hsla(${hue}, 70%, 60%, ${opacity})`;
}

export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

export function isLightColor(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const brightness = Math.sqrt(
    0.299 * (r * r) +
    0.587 * (g * g) +
    0.114 * (b * b)
  );
  return brightness > 127.5;
}
