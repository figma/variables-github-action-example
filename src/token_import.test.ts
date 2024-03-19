import { GetLocalVariablesResponse } from '@figma/rest-api-spec'
import {
  FlattenedTokensByFile,
  generatePostVariablesPayload,
  readJsonFiles,
} from './token_import.js'

jest.mock('fs', () => {
  const MOCK_FILE_INFO: { [fileName: string]: string } = {
    'tokens/collection1.mode1.json': JSON.stringify({
      spacing: {
        '1': {
          $type: 'number',
          $value: 8,
          $description: '8px spacing',
        },
        '2': {
          $type: 'number',
          $value: 16,
          $description: '16px spacing',
        },
      },
    }),
    'tokens/collection2.mode1.json': JSON.stringify({
      color: {
        brand: {
          radish: {
            $type: 'color',
            $value: '#ffbe16',
            $description: 'Radish color',
          },
          pear: {
            $type: 'color',
            $value: '#ffbe16',
            $description: 'Pear color',
          },
        },
      },
    }),
    'tokens/collection3.mode1.json': JSON.stringify({
      token1: { $type: 'string', $value: 'value1' },
      token2: { $type: 'string', $value: 'value2' },
    }),
    'no_tokens.mode1.json': JSON.stringify({
      foo: 'bar',
    }),
    'empty_file.mode1.json': '',
    'file_with_$_keys.mode1.json': JSON.stringify({
      $foo: 'bar',
      token1: { $type: 'string', $value: 'value1' },
    }),
  }

  return {
    readFileSync: (fpath: string) => {
      if (fpath in MOCK_FILE_INFO) {
        return MOCK_FILE_INFO[fpath]
      } else {
        return '{}'
      }
    },
  }
})

describe('readJsonFiles', () => {
  it('reads all files and flattens tokens inside', () => {
    const result = readJsonFiles([
      'tokens/collection1.mode1.json',
      'tokens/collection2.mode1.json',
      'tokens/collection3.mode1.json',
    ])
    expect(result).toEqual({
      'collection1.mode1.json': {
        'spacing/1': { $type: 'number', $value: 8, $description: '8px spacing' },
        'spacing/2': { $type: 'number', $value: 16, $description: '16px spacing' },
      },
      'collection2.mode1.json': {
        'color/brand/radish': { $type: 'color', $value: '#ffbe16', $description: 'Radish color' },
        'color/brand/pear': { $type: 'color', $value: '#ffbe16', $description: 'Pear color' },
      },
      'collection3.mode1.json': {
        token1: { $type: 'string', $value: 'value1' },
        token2: { $type: 'string', $value: 'value2' },
      },
    })
  })

  it('handles files that do not have any tokens', () => {
    const result = readJsonFiles(['no_tokens.mode1.json'])
    expect(result).toEqual({ 'no_tokens.mode1.json': {} })
  })

  it('handles duplicate collections and modes', () => {
    expect(() => {
      readJsonFiles([
        'tokens/collection1.mode1.1.json',
        'tokens/collection1.mode1.2.json',
        'tokens/collection1.mode1.3.json',
      ])
    }).toThrowError('Duplicate collection and mode in file: tokens/collection1.mode1.2.json')
  })

  it('handles file names that do not match the expected format', () => {
    expect(() => {
      readJsonFiles(['tokens/collection1.mode1.json', 'tokens/collection2.mode1.json', 'foo.json'])
    }).toThrowError(
      'Invalid tokens file name: foo.json. File names must be in the format: {collectionName}.{modeName}.json',
    )
  })

  it('ignores keys that start with $', () => {
    const result = readJsonFiles(['file_with_$_keys.mode1.json'])
    expect(result).toEqual({
      'file_with_$_keys.mode1.json': { token1: { $type: 'string', $value: 'value1' } },
    })
  })

  it('handles empty files', () => {
    expect(() => {
      readJsonFiles(['empty_file.mode1.json'])
    }).toThrowError('Invalid tokens file: empty_file.mode1.json. File is empty.')
  })
})

describe('generatePostVariablesPayload', () => {
  it('does an initial sync', async () => {
    const localVariablesResponse: GetLocalVariablesResponse = {
      status: 200,
      error: false,
      meta: {
        variableCollections: {},
        variables: {},
      },
    }

    const tokensByFile: FlattenedTokensByFile = {
      'primitives.mode1.json': {
        'spacing/1': { $type: 'number', $value: 8, $description: '8px spacing' },
        'spacing/2': { $type: 'number', $value: 16 },
        'color/brand/radish': { $type: 'color', $value: '#ffbe16', $description: 'Radish color' },
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

    const result = generatePostVariablesPayload(tokensByFile, localVariablesResponse)
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

    expect(result.variableModes).toEqual([
      {
        action: 'UPDATE',
        id: 'mode1',
        name: 'mode1',
        variableCollectionId: 'primitives',
      },
      {
        action: 'CREATE',
        id: 'mode2',
        name: 'mode2',
        variableCollectionId: 'primitives',
      },
      {
        action: 'UPDATE',
        id: 'mode1',
        name: 'mode1',
        variableCollectionId: 'tokens',
      },
      {
        action: 'CREATE',
        id: 'mode2',
        name: 'mode2',
        variableCollectionId: 'tokens',
      },
    ])

    expect(result.variables).toEqual([
      // variables for the primitives collection
      {
        action: 'CREATE',
        id: 'spacing/1',
        name: 'spacing/1',
        variableCollectionId: 'primitives',
        resolvedType: 'FLOAT',
        description: '8px spacing',
      },
      {
        action: 'CREATE',
        id: 'spacing/2',
        name: 'spacing/2',
        variableCollectionId: 'primitives',
        resolvedType: 'FLOAT',
      },
      {
        action: 'CREATE',
        id: 'color/brand/radish',
        name: 'color/brand/radish',
        variableCollectionId: 'primitives',
        resolvedType: 'COLOR',
        description: 'Radish color',
      },
      {
        action: 'CREATE',
        id: 'color/brand/pear',
        name: 'color/brand/pear',
        variableCollectionId: 'primitives',
        resolvedType: 'COLOR',
      },

      // variables for the tokens collection
      {
        action: 'CREATE',
        id: 'spacing/spacing-sm',
        name: 'spacing/spacing-sm',
        variableCollectionId: 'tokens',
        resolvedType: 'FLOAT',
      },
      {
        action: 'CREATE',
        id: 'surface/surface-brand',
        name: 'surface/surface-brand',
        variableCollectionId: 'tokens',
        resolvedType: 'COLOR',
      },
    ])

    expect(result.variableModeValues).toEqual([
      // primitives, mode1
      { variableId: 'spacing/1', modeId: 'mode1', value: 8 },
      { variableId: 'spacing/2', modeId: 'mode1', value: 16 },
      {
        variableId: 'color/brand/radish',
        modeId: 'mode1',
        value: { r: 1, g: 0.7450980392156863, b: 0.08627450980392157 },
      },
      {
        variableId: 'color/brand/pear',
        modeId: 'mode1',
        value: { r: 1, g: 0.7450980392156863, b: 0.08627450980392157 },
      },

      // primitives, mode2
      { variableId: 'spacing/1', modeId: 'mode2', value: 8 },
      { variableId: 'spacing/2', modeId: 'mode2', value: 16 },
      {
        variableId: 'color/brand/radish',
        modeId: 'mode2',
        value: { r: 0.00392156862745098, g: 0.00392156862745098, b: 0.00392156862745098 },
      },
      {
        variableId: 'color/brand/pear',
        modeId: 'mode2',
        value: { r: 0.00392156862745098, g: 0.00392156862745098, b: 0.00392156862745098 },
      },

      // tokens, mode1
      {
        variableId: 'spacing/spacing-sm',
        modeId: 'mode1',
        value: { type: 'VARIABLE_ALIAS', id: 'spacing/1' },
      },
      {
        variableId: 'surface/surface-brand',
        modeId: 'mode1',
        value: { type: 'VARIABLE_ALIAS', id: 'color/brand/radish' },
      },

      // tokens, mode2
      {
        variableId: 'spacing/spacing-sm',
        modeId: 'mode2',
        value: { type: 'VARIABLE_ALIAS', id: 'spacing/1' },
      },
      {
        variableId: 'surface/surface-brand',
        modeId: 'mode2',
        value: { type: 'VARIABLE_ALIAS', id: 'color/brand/pear' },
      },
    ])
  })

  it('does an in-place update', async () => {
    const localVariablesResponse: GetLocalVariablesResponse = {
      status: 200,
      error: false,
      meta: {
        variableCollections: {
          'VariableCollectionId:1:1': {
            id: 'VariableCollectionId:1:1',
            name: 'primitives',
            modes: [{ modeId: '1:0', name: 'mode1' }],
            defaultModeId: '1:0',
            remote: false,
            key: 'variableKey',
            hiddenFromPublishing: false,
            variableIds: ['VariableID:2:1', 'VariableID:2:2', 'VariableID:2:3', 'VariableID:2:4'],
          },
        },
        variables: {
          'VariableID:2:1': {
            id: 'VariableID:2:1',
            name: 'spacing/1',
            key: 'variable_key',
            variableCollectionId: 'VariableCollectionId:1:1',
            resolvedType: 'FLOAT',
            valuesByMode: {
              '1:0': 8,
            },
            remote: false,
            description: '8px spacing',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: { WEB: 'web', ANDROID: 'android' },
          },
          'VariableID:2:2': {
            id: 'VariableID:2:2',
            name: 'spacing/2',
            key: 'variable_key2',
            variableCollectionId: 'VariableCollectionId:1:1',
            resolvedType: 'FLOAT',
            valuesByMode: {
              '1:0': 15, // Different from token value
            },
            remote: false,
            description: 'Another spacing',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: { WEB: 'web', ANDROID: 'android' },
          },
          'VariableID:2:3': {
            id: 'VariableID:2:3',
            name: 'color/brand/radish',
            key: 'variable_key3',
            variableCollectionId: 'VariableCollectionId:1:1',
            resolvedType: 'COLOR',
            valuesByMode: {
              '1:0': { r: 1, g: 0.7450980392156863, b: 0.08627450980392157, a: 1 },
            },
            remote: false,
            description: 'Radish color',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
          'VariableID:2:4': {
            id: 'VariableID:2:4',
            name: 'color/brand/pear',
            key: 'variable_key4',
            variableCollectionId: 'VariableCollectionId:1:1',
            resolvedType: 'COLOR',
            valuesByMode: {
              // Different from token value
              '1:0': { r: 1, g: 0, b: 0.08627450980392157, a: 1 },
            },
            remote: false,
            description: 'Pear color',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
        },
      },
    }

    const tokensByFile: FlattenedTokensByFile = {
      'primitives.mode1.json': {
        'spacing/1': {
          $type: 'number',
          $value: 8,
          $description: '8px spacing',
          $extensions: {
            'com.figma': {
              hiddenFromPublishing: false,
              scopes: ['ALL_SCOPES'],
              codeSyntax: { WEB: 'web', ANDROID: 'android' },
            },
          },
        },
        'spacing/2': {
          $type: 'number',
          $value: 16,
          $description: 'changed description',
          $extensions: {
            'com.figma': {
              hiddenFromPublishing: true,
              scopes: ['TEXT_CONTENT'],
              codeSyntax: { WEB: 'web', ANDROID: 'android_new' },
            },
          },
        },
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

    const result = generatePostVariablesPayload(tokensByFile, localVariablesResponse)
    expect(result.variableCollections).toEqual([
      {
        action: 'CREATE',
        id: 'tokens',
        name: 'tokens',
        initialModeId: 'mode1',
      },
    ])

    expect(result.variableModes).toEqual([
      {
        action: 'CREATE',
        id: 'mode2',
        name: 'mode2',
        variableCollectionId: 'VariableCollectionId:1:1',
      },
      {
        action: 'UPDATE',
        id: 'mode1',
        name: 'mode1',
        variableCollectionId: 'tokens',
      },
      {
        action: 'CREATE',
        id: 'mode2',
        name: 'mode2',
        variableCollectionId: 'tokens',
      },
    ])

    expect(result.variables).toEqual([
      {
        action: 'UPDATE',
        id: 'VariableID:2:2',
        description: 'changed description',
        hiddenFromPublishing: true,
        scopes: ['TEXT_CONTENT'],
        codeSyntax: { WEB: 'web', ANDROID: 'android_new' },
      },
      // new variables for the tokens collection
      {
        action: 'CREATE',
        id: 'spacing/spacing-sm',
        name: 'spacing/spacing-sm',
        variableCollectionId: 'tokens',
        resolvedType: 'FLOAT',
      },
      {
        action: 'CREATE',
        id: 'surface/surface-brand',
        name: 'surface/surface-brand',
        variableCollectionId: 'tokens',
        resolvedType: 'COLOR',
      },
    ])

    expect(result.variableModeValues).toEqual([
      // primitives, mode1
      { variableId: 'VariableID:2:2', modeId: '1:0', value: 16 },
      {
        variableId: 'VariableID:2:4',
        modeId: '1:0',
        value: { r: 1, g: 0.7450980392156863, b: 0.08627450980392157 },
      },

      // primitives, mode2
      { variableId: 'VariableID:2:1', modeId: 'mode2', value: 8 },
      { variableId: 'VariableID:2:2', modeId: 'mode2', value: 16 },
      {
        variableId: 'VariableID:2:3',
        modeId: 'mode2',
        value: { r: 0.00392156862745098, g: 0.00392156862745098, b: 0.00392156862745098 },
      },
      {
        variableId: 'VariableID:2:4',
        modeId: 'mode2',
        value: { r: 0.00392156862745098, g: 0.00392156862745098, b: 0.00392156862745098 },
      },

      // tokens, mode1
      {
        variableId: 'spacing/spacing-sm',
        modeId: 'mode1',
        value: { type: 'VARIABLE_ALIAS', id: 'VariableID:2:1' },
      },
      {
        variableId: 'surface/surface-brand',
        modeId: 'mode1',
        value: { type: 'VARIABLE_ALIAS', id: 'VariableID:2:3' },
      },

      // tokens, mode2
      {
        variableId: 'spacing/spacing-sm',
        modeId: 'mode2',
        value: { type: 'VARIABLE_ALIAS', id: 'VariableID:2:1' },
      },
      {
        variableId: 'surface/surface-brand',
        modeId: 'mode2',
        value: { type: 'VARIABLE_ALIAS', id: 'VariableID:2:4' },
      },
    ])
  })

  it('noops when everything is already in sync (with aliases)', () => {
    const localVariablesResponse: GetLocalVariablesResponse = {
      status: 200,
      error: false,
      meta: {
        variableCollections: {
          'VariableCollectionId:1:1': {
            id: 'VariableCollectionId:1:1',
            name: 'collection',
            modes: [{ modeId: '1:0', name: 'mode1' }],
            defaultModeId: '1:0',
            remote: false,
            key: 'variableKey',
            hiddenFromPublishing: false,
            variableIds: ['VariableID:2:1', 'VariableID:2:2'],
          },
        },
        variables: {
          'VariableID:2:1': {
            id: 'VariableID:2:1',
            name: 'var1',
            key: 'variable_key',
            variableCollectionId: 'VariableCollectionId:1:1',
            resolvedType: 'STRING',
            valuesByMode: {
              '1:0': 'hello world!',
            },
            remote: false,
            description: '',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
          'VariableID:2:2': {
            id: 'VariableID:2:2',
            name: 'var2',
            key: 'variable_key2',
            variableCollectionId: 'VariableCollectionId:1:1',
            resolvedType: 'STRING',
            valuesByMode: {
              '1:0': { type: 'VARIABLE_ALIAS', id: 'VariableID:2:1' },
            },
            remote: false,
            description: '',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
        },
      },
    }

    const tokensByFile: FlattenedTokensByFile = {
      'collection.mode1.json': {
        var1: {
          $type: 'string',
          $value: 'hello world!',
          $description: '',
          $extensions: {
            'com.figma': {
              hiddenFromPublishing: false,
              scopes: ['ALL_SCOPES'],
              codeSyntax: {},
            },
          },
        },
        var2: {
          $type: 'string',
          $value: '{var1}',
          $description: '',
          $extensions: {
            'com.figma': {
              hiddenFromPublishing: false,
              scopes: ['ALL_SCOPES'],
              codeSyntax: {},
            },
          },
        },
      },
    }

    const result = generatePostVariablesPayload(tokensByFile, localVariablesResponse)

    expect(result).toEqual({
      variableCollections: [],
      variableModes: [],
      variables: [],
      variableModeValues: [],
    })
  })

  it('noops if tokens happen to match remote collections and variables', () => {
    const localVariablesResponse: GetLocalVariablesResponse = {
      status: 200,
      error: false,
      meta: {
        variableCollections: {
          'VariableCollectionId:1:1': {
            id: 'VariableCollectionId:1:1',
            name: 'collection',
            modes: [{ modeId: '1:0', name: 'mode1' }],
            defaultModeId: '1:0',
            remote: true,
            key: 'variableKey',
            hiddenFromPublishing: false,
            variableIds: ['VariableID:2:1', 'VariableID:2:2'],
          },
        },
        variables: {
          'VariableID:2:1': {
            id: 'VariableID:2:1',
            name: 'var1',
            key: 'variable_key',
            variableCollectionId: 'VariableCollectionId:1:1',
            resolvedType: 'STRING',
            valuesByMode: {
              '1:0': 'hello world!',
            },
            remote: true,
            description: '',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
          'VariableID:2:2': {
            id: 'VariableID:2:2',
            name: 'var2',
            key: 'variable_key2',
            variableCollectionId: 'VariableCollectionId:1:1',
            resolvedType: 'STRING',
            valuesByMode: {
              '1:0': { type: 'VARIABLE_ALIAS', id: 'VariableID:2:1' },
            },
            remote: true,
            description: '',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
        },
      },
    }

    const tokensByFile: FlattenedTokensByFile = {
      'collection.mode1.json': {
        var1: {
          $type: 'string',
          $value: 'hello world!',
          $description: '',
          $extensions: {
            'com.figma': {
              hiddenFromPublishing: false,
              scopes: ['ALL_SCOPES'],
              codeSyntax: {},
            },
          },
        },
        var2: {
          $type: 'string',
          $value: '{var1}',
          $description: '',
          $extensions: {
            'com.figma': {
              hiddenFromPublishing: false,
              scopes: ['ALL_SCOPES'],
              codeSyntax: {},
            },
          },
        },
      },
    }

    const result = generatePostVariablesPayload(tokensByFile, localVariablesResponse)

    expect(result).toEqual({
      variableCollections: [],
      variableModes: [],
      variables: [],
      variableModeValues: [],
    })
  })

  it('throws on attempted modifications to remote variables', () => {
    const localVariablesResponse: GetLocalVariablesResponse = {
      status: 200,
      error: false,
      meta: {
        variableCollections: {
          'VariableCollectionId:1:1': {
            id: 'VariableCollectionId:1:1',
            name: 'collection',
            modes: [{ modeId: '1:0', name: 'mode1' }],
            defaultModeId: '1:0',
            remote: true,
            key: 'variableKey',
            hiddenFromPublishing: false,
            variableIds: ['VariableID:2:1', 'VariableID:2:2'],
          },
        },
        variables: {
          'VariableID:2:1': {
            id: 'VariableID:2:1',
            name: 'var1',
            key: 'variable_key',
            variableCollectionId: 'VariableCollectionId:1:1',
            resolvedType: 'STRING',
            valuesByMode: {
              '1:0': 'hello world!',
            },
            remote: true,
            description: '',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
          'VariableID:2:2': {
            id: 'VariableID:2:2',
            name: 'var2',
            key: 'variable_key2',
            variableCollectionId: 'VariableCollectionId:1:1',
            resolvedType: 'STRING',
            valuesByMode: {
              '1:0': { type: 'VARIABLE_ALIAS', id: 'VariableID:2:1' },
            },
            remote: true,
            description: '',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
        },
      },
    }

    const tokensByFile: FlattenedTokensByFile = {
      'collection.mode1.json': {
        var1: {
          $type: 'string',
          $value: 'hello world!',
          $description: '',
          $extensions: {
            'com.figma': {
              hiddenFromPublishing: true, // modification
              scopes: ['ALL_SCOPES'],
              codeSyntax: {},
            },
          },
        },
        var2: {
          $type: 'string',
          $value: '{var1}',
          $description: '',
          $extensions: {
            'com.figma': {
              hiddenFromPublishing: false,
              scopes: ['ALL_SCOPES'],
              codeSyntax: {},
            },
          },
        },
      },
    }

    expect(() => {
      generatePostVariablesPayload(tokensByFile, localVariablesResponse)
    }).toThrowError(`Cannot update remote variable "var1" in collection "collection"`)
  })

  it('updates aliases to remote variables', () => {
    const localVariablesResponse: GetLocalVariablesResponse = {
      status: 200,
      error: false,
      meta: {
        variableCollections: {
          'VariableCollectionId:1:1': {
            id: 'VariableCollectionId:1:1',
            name: 'primitives',
            modes: [{ modeId: '1:0', name: 'mode1' }],
            defaultModeId: '1:0',
            remote: true,
            key: 'variableCollectionKey1',
            hiddenFromPublishing: false,
            variableIds: ['VariableID:1:2', 'VariableID:1:3'],
          },
          'VariableCollectionId:2:1': {
            id: 'VariableCollectionId:2:1',
            name: 'tokens',
            modes: [{ modeId: '2:0', name: 'mode1' }],
            defaultModeId: '2:0',
            remote: false,
            key: 'variableCollectionKey2',
            hiddenFromPublishing: false,
            variableIds: ['VariableID:2:1'],
          },
        },
        variables: {
          // 2 color variables in the primitives collection
          'VariableID:1:2': {
            id: 'VariableID:1:2',
            name: 'gray/100',
            key: 'variableKey1',
            variableCollectionId: 'VariableCollectionId:1:1',
            resolvedType: 'COLOR',
            valuesByMode: {
              '1:0': { r: 0.98, g: 0.98, b: 0.98, a: 1 },
            },
            remote: true,
            description: 'light gray',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
          'VariableID:1:3': {
            id: 'VariableID:1:3',
            name: 'gray/200',
            key: 'variableKey2',
            variableCollectionId: 'VariableCollectionId:1:1',
            resolvedType: 'COLOR',
            valuesByMode: {
              '1:0': { r: 0.96, g: 0.96, b: 0.96, a: 1 },
            },
            remote: true,
            description: 'light gray',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
          // 1 color variable in the tokens collection
          'VariableID:2:1': {
            id: 'VariableID:2:1',
            name: 'surface/surface-brand',
            key: 'variableKey3',
            variableCollectionId: 'VariableCollectionId:2:1',
            resolvedType: 'COLOR',
            valuesByMode: {
              '2:0': { type: 'VARIABLE_ALIAS', id: 'VariableID:1:2' },
            },
            remote: false,
            description: 'light gray',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
        },
      },
    }

    const tokensByFile: FlattenedTokensByFile = {
      'tokens.mode1.json': {
        // Change the alias to point to the other variable in the primitives collection
        'surface/surface-brand': { $type: 'color', $value: '{gray.200}' },
      },
    }

    const result = generatePostVariablesPayload(tokensByFile, localVariablesResponse)

    expect(result.variableCollections).toEqual([])
    expect(result.variableModes).toEqual([])
    expect(result.variables).toEqual([])
    expect(result.variableModeValues).toEqual([
      {
        variableId: 'VariableID:2:1',
        modeId: '2:0',
        value: { type: 'VARIABLE_ALIAS', id: 'VariableID:1:3' },
      },
    ])
  })

  it('throws on unsupported token types', async () => {
    const localVariablesResponse: GetLocalVariablesResponse = {
      status: 200,
      error: false,
      meta: {
        variableCollections: {},
        variables: {},
      },
    }

    const tokensByFile: any = {
      'primitives.mode1.json': {
        'font-weight-default': { $type: 'fontWeight', $value: 400 },
      },
    }

    expect(() => {
      generatePostVariablesPayload(tokensByFile, localVariablesResponse)
    }).toThrowError('Invalid token $type: fontWeight')
  })

  it('throws on duplicate variable collections in the Figma file', () => {
    const localVariablesResponse: GetLocalVariablesResponse = {
      status: 200,
      error: false,
      meta: {
        variableCollections: {
          'VariableCollectionId:1:1': {
            id: 'VariableCollectionId:1:1',
            name: 'collection',
            modes: [{ modeId: '1:0', name: 'mode1' }],
            defaultModeId: '1:0',
            remote: false,
            key: 'variableCollectionKey1',
            hiddenFromPublishing: false,
            variableIds: [],
          },
          'VariableCollectionId:1:2': {
            id: 'VariableCollectionId:1:2',
            name: 'collection',
            modes: [{ modeId: '2:0', name: 'mode1' }],
            defaultModeId: '2:0',
            remote: false,
            key: 'variableCollectionKey2',
            hiddenFromPublishing: false,
            variableIds: [],
          },
        },
        variables: {},
      },
    }

    const tokensByFile: FlattenedTokensByFile = {
      'collection.mode1.json': {
        var1: {
          $type: 'string',
          $value: 'hello world!',
          $description: '',
          $extensions: {
            'com.figma': {
              hiddenFromPublishing: false,
              scopes: ['ALL_SCOPES'],
              codeSyntax: {},
            },
          },
        },
      },
    }

    expect(() => {
      generatePostVariablesPayload(tokensByFile, localVariablesResponse)
    }).toThrowError('Duplicate variable collection in file: collection')
  })
})
