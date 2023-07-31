import { Color } from './figma_api.js'

/**
 * Compares two colors for approximate equality since converting between Figma RGBA objects (from 0 -> 1) and
 * hex colors can result in slight differences.
 */
export function colorApproximatelyEqual(colorA: Color, colorB: Color) {
  const EPSILON = 0.003

  return (
    Math.abs(colorA.r - colorB.r) < EPSILON &&
    Math.abs(colorA.g - colorB.g) < EPSILON &&
    Math.abs(colorA.b - colorB.b) < EPSILON &&
    Math.abs((colorA.a === undefined ? 1 : colorA.a) - (colorB.a === undefined ? 1 : colorB.a)) <
      EPSILON
  )
}

export function parseColor(color: string): Color {
  color = color.trim()
  const rgbRegex = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/
  const rgbaRegex = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([\d.]+)\s*\)$/
  const hslRegex = /^hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)$/
  const hslaRegex = /^hsla\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*,\s*([\d.]+)\s*\)$/
  const hexRegex = /^#([A-Fa-f0-9]{3}){1,2}$/
  const floatRgbRegex =
    /^\{\s*r:\s*[\d\.]+,\s*g:\s*[\d\.]+,\s*b:\s*[\d\.]+(,\s*opacity:\s*[\d\.]+)?\s*\}$/

  if (rgbRegex.test(color)) {
    const [, r, g, b] = color.match(rgbRegex)!
    return { r: parseInt(r) / 255, g: parseInt(g) / 255, b: parseInt(b) / 255 }
  } else if (rgbaRegex.test(color)) {
    const [, r, g, b, a] = color.match(rgbaRegex)!
    return {
      r: parseInt(r) / 255,
      g: parseInt(g) / 255,
      b: parseInt(b) / 255,
      a: parseFloat(a),
    }
  } else if (hslRegex.test(color)) {
    const [, h, s, l] = color.match(hslRegex)!
    return hslToRgbFloat(parseInt(h), parseInt(s) / 100, parseInt(l) / 100)
  } else if (hslaRegex.test(color)) {
    const [, h, s, l, a] = color.match(hslaRegex)!
    return Object.assign(hslToRgbFloat(parseInt(h), parseInt(s) / 100, parseInt(l) / 100), {
      a: parseFloat(a),
    })
  } else if (hexRegex.test(color)) {
    const hexValue = color.substring(1)
    const expandedHex =
      hexValue.length === 3
        ? hexValue
            .split('')
            .map((char) => char + char)
            .join('')
        : hexValue
    return {
      r: parseInt(expandedHex.slice(0, 2), 16) / 255,
      g: parseInt(expandedHex.slice(2, 4), 16) / 255,
      b: parseInt(expandedHex.slice(4, 6), 16) / 255,
    }
  } else if (floatRgbRegex.test(color)) {
    return JSON.parse(color)
  } else {
    throw new Error('Invalid color format')
  }
}

function hslToRgbFloat(h: number, s: number, l: number) {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  if (s === 0) {
    return { r: l, g: l, b: l }
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const r = hue2rgb(p, q, (h + 1 / 3) % 1)
  const g = hue2rgb(p, q, h % 1)
  const b = hue2rgb(p, q, (h - 1 / 3) % 1)

  return { r, g, b }
}
