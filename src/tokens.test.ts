import { Token, generatePostVariablesPayload, readJsonFiles } from './tokens.js'
import FigmaApi from './figma_api.js'

jest.mock('./figma_api.js')

jest.mock('fs', () => {
  const MOCK_FILE_INFO: { [fileName: string]: string } = {
    'valid_file1.json': JSON.stringify({
      spacing: {
        '1': {
          $type: 'number',
          $value: 8,
        },
        '2': {
          $type: 'number',
          $value: 16,
        },
      },
    }),
    'valid_file2.json': JSON.stringify({
      color: {
        brand: {
          radish: {
            $type: 'color',
            $value: '#ffbe16',
          },
          pear: {
            $type: 'color',
            $value: '#ffbe16',
          },
        },
      },
    }),
    'valid_file3.json': JSON.stringify({
      token1: { $type: 'string', $value: 'value1' },
      token2: { $type: 'string', $value: 'value2' },
    }),
    'no_tokens.json': JSON.stringify({
      foo: 'bar',
    }),
  }

  return {
    readFileSync: (fpath: string) => {
      if (fpath in MOCK_FILE_INFO) {
        return MOCK_FILE_INFO[fpath]
      }
      throw 'unexpected fpath'
    },
  }
})

jest.mock('axios', () => {
  return {
    request: jest.fn(),
  }
})

describe('readJsonFiles', () => {
  it('reads all files and flattens tokens inside', () => {
    const result = readJsonFiles(['valid_file1.json', 'valid_file2.json', 'valid_file3.json'])
    expect(result).toEqual({
      'valid_file1.json': {
        'spacing/1': { $type: 'number', $value: 8 },
        'spacing/2': { $type: 'number', $value: 16 },
      },
      'valid_file2.json': {
        'color/brand/radish': { $type: 'color', $value: '#ffbe16' },
        'color/brand/pear': { $type: 'color', $value: '#ffbe16' },
      },
      'valid_file3.json': {
        token1: { $type: 'string', $value: 'value1' },
        token2: { $type: 'string', $value: 'value2' },
      },
    })
  })

  it('handles files that do not have any tokens', () => {
    const result = readJsonFiles(['no_tokens.json'])
    expect(result).toEqual({ 'no_tokens.json': {} })
  })
})

describe('generatePostVariablesPayload', () => {
  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    ;(FigmaApi as any).mockImplementation(() => {
      return {
        getLocalVariables: async (_: string) => {
          return {
            status: 200,
            error: false,
            meta: {
              variableCollections: {},
              variables: {},
            },
          }
        },
      }
    })
  })

  it('does an initial sync', async () => {
    const tokensByFile: {
      [fileName: string]: {
        [tokenName: string]: Token
      }
    } = {
      'primitives.mode1.json': {
        'spacing/1': { $type: 'number', $value: 8 },
        'spacing/2': { $type: 'number', $value: 16 },
        'color/brand/radish': { $type: 'color', $value: '#ffbe16' },
        'color/brand/pear': { $type: 'color', $value: '#ffbe16' },
      },
      'primitives.mode2.json': {
        'spacing/1': { $type: 'number', $value: 8 },
        'spacing/2': { $type: 'number', $value: 16 },
        'color/brand/radish': { $type: 'color', $value: '#010101' },
        'color/brand/pear': { $type: 'color', $value: '#010101' },
      },
      'tokens.mode1.json': {
        'spacing/spacing-sm': { $type: 'number', $value: '{spacing.1}' },
        'surface/surface-brand': { $type: 'color', $value: '{color.brand.radish}' },
      },
      'tokens.mode2.json': {
        'spacing/spacing-sm': { $type: 'number', $value: '{spacing.1}' },
        'surface/surface-brand': { $type: 'color', $value: '{color.brand.pear}' },
      },
    }

    const result = await generatePostVariablesPayload(tokensByFile, 'access_token', 'file_key')
    console.log(result.variableCollections)
    expect(result.variableCollections).toEqual([
      {
        action: 'CREATE',
        id: 'primitives',
        name: 'primitives',
        initialModeId: 'mode1',
      },
      {
        action: 'CREATE',
        id: 'tokens',
        name: 'tokens',
        initialModeId: 'mode1',
      },
    ])
  })
})
