import { colorApproximatelyEqual, parseColor, rgbToHex } from './color.js'

describe('colorApproximatelyEqual', () => {
  it('compares by hex value', () => {
    expect(colorApproximatelyEqual({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 })).toBe(true)
    expect(colorApproximatelyEqual({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0, a: 1 })).toBe(true)
    expect(
      colorApproximatelyEqual({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 0, g: 0, b: 0, a: 0.5 }),
    ).toBe(true)
    expect(colorApproximatelyEqual({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0, a: 0 })).toBe(false)

    expect(colorApproximatelyEqual({ r: 0, g: 0, b: 0 }, { r: 0.001, g: 0, b: 0 })).toBe(true)
    expect(colorApproximatelyEqual({ r: 0, g: 0, b: 0 }, { r: 0.0028, g: 0, b: 0 })).toBe(false)
  })
})

describe('parseColor', () => {
  it('parses hex values', () => {
    // 3-value syntax
    expect(parseColor('#000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(parseColor('#fff')).toEqual({ r: 1, g: 1, b: 1 })
    expect(parseColor('#FFF')).toEqual({ r: 1, g: 1, b: 1 })
    expect(parseColor('#f09')).toEqual({ r: 1, g: 0, b: 153 / 255 })
    expect(parseColor('#F09')).toEqual({ r: 1, g: 0, b: 153 / 255 })

    // 4-value syntax
    expect(parseColor('#0000')).toEqual({ r: 0, g: 0, b: 0, a: 0 })
    expect(parseColor('#000F')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    expect(parseColor('#f09a')).toEqual({ r: 1, g: 0, b: 153 / 255, a: 170 / 255 })

    // 6-value syntax
    expect(parseColor('#000000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(parseColor('#ffffff')).toEqual({ r: 1, g: 1, b: 1 })
    expect(parseColor('#FFFFFF')).toEqual({ r: 1, g: 1, b: 1 })
    expect(parseColor('#ff0099')).toEqual({ r: 1, g: 0, b: 153 / 255 })
    expect(parseColor('#FF0099')).toEqual({ r: 1, g: 0, b: 153 / 255 })

    // 8-value syntax
    expect(parseColor('#00000000')).toEqual({ r: 0, g: 0, b: 0, a: 0 })
    expect(parseColor('#00000080')).toEqual({ r: 0, g: 0, b: 0, a: 128 / 255 })
    expect(parseColor('#000000ff')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    expect(parseColor('#5EE0DCAB')).toEqual({
      r: 0.3686274509803922,
      g: 0.8784313725490196,
      b: 0.8627450980392157,
      a: 0.6705882352941176,
    })
  })

  it('handles invalid hex values', () => {
    expect(() => parseColor('#')).toThrowError('Invalid color format')
    expect(() => parseColor('#0')).toThrowError('Invalid color format')
    expect(() => parseColor('#00')).toThrowError('Invalid color format')
    expect(() => parseColor('#0000000')).toThrowError('Invalid color format')
    expect(() => parseColor('#000000000')).toThrowError('Invalid color format')
    expect(() => parseColor('#hhh')).toThrowError('Invalid color format')
  })
})

describe('rgbToHex', () => {
  it('should convert rgb to hex', () => {
    expect(rgbToHex({ r: 1, g: 1, b: 1 })).toBe('#ffffff')
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000')
    expect(rgbToHex({ r: 0.5, g: 0.5, b: 0.5 })).toBe('#808080')
    expect(rgbToHex({ r: 0.3686274509803922, g: 0.8784313725490196, b: 0.8627450980392157 })).toBe(
      '#5ee0dc',
    )
  })

  it('should convert rgba to hex', () => {
    expect(rgbToHex({ r: 1, g: 1, b: 1, a: 1 })).toBe('#ffffff')
    expect(rgbToHex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#00000080')
    expect(rgbToHex({ r: 0.5, g: 0.5, b: 0.5, a: 0.5 })).toBe('#80808080')
    expect(
      rgbToHex({ r: 0.3686274509803922, g: 0.8784313725490196, b: 0.8627450980392157, a: 0 }),
    ).toBe('#5ee0dc00')
  })
})
