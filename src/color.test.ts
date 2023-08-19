import { rgbToHex } from './color.js'

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
