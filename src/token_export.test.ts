import { GetLocalVariablesResponse } from '@figma/rest-api-spec'
import { tokenFilesFromLocalVariables } from './token_export.js'

describe('tokenFilesFromLocalVariables', () => {
  it('ignores remote variables', () => {
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
            key: 'variableKey',
            hiddenFromPublishing: false,
            variableIds: ['VariableID:2:1'],
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
            remote: true,
            description: '',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
        },
      },
    }

    const tokenFiles = tokenFilesFromLocalVariables(localVariablesResponse)
    expect(tokenFiles).toEqual({})
  })

  it('returns token files', () => {
    const localVariablesResponse: GetLocalVariablesResponse = {
      status: 200,
      error: false,
      meta: {
        variableCollections: {
          'VariableCollectionId:1:1': {
            id: 'VariableCollectionId:1:1',
            name: 'primitives',
            modes: [
              { modeId: '1:0', name: 'mode1' },
              { modeId: '1:1', name: 'mode2' },
            ],
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
              '1:1': 8,
            },
            remote: false,
            description: '8px spacing',
            hiddenFromPublishing: true,
            scopes: ['TEXT_CONTENT'],
            codeSyntax: { WEB: 'web', ANDROID: 'android' },
          },
          'VariableID:2:2': {
            id: 'VariableID:2:2',
            name: 'spacing/2',
            key: 'variable_key2',
            variableCollectionId: 'VariableCollectionId:1:1',
            resolvedType: 'FLOAT',
            valuesByMode: {
              '1:0': 16,
              '1:1': 16,
            },
            remote: false,
            description: '16px spacing',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
          'VariableID:2:3': {
            id: 'VariableID:2:3',
            name: 'color/brand/radish',
            key: 'variable_key3',
            variableCollectionId: 'VariableCollectionId:1:1',
            resolvedType: 'COLOR',
            valuesByMode: {
              '1:0': { r: 1, g: 0.7450980392156863, b: 0.08627450980392157, a: 1 },
              '1:1': { r: 1, g: 0.796078431372549, b: 0.7176470588235294, a: 1 },
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
              '1:0': { r: 1, g: 0, b: 0.08627450980392157, a: 1 },
              '1:1': { r: 0.8705882352941177, g: 0.9529411764705882, b: 0.34509803921568627, a: 1 },
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

    const tokenFiles = tokenFilesFromLocalVariables(localVariablesResponse)

    expect(tokenFiles['primitives.mode1.json']).toEqual({
      spacing: {
        '1': {
          $type: 'number',
          $value: 8,
          $description: '8px spacing',
          $extensions: {
            'com.figma': {
              hiddenFromPublishing: true,
              scopes: ['TEXT_CONTENT'],
              codeSyntax: { WEB: 'web', ANDROID: 'android' },
            },
          },
        },
        '2': {
          $type: 'number',
          $value: 16,
          $description: '16px spacing',
          $extensions: {
            'com.figma': {
              hiddenFromPublishing: false,
              scopes: ['ALL_SCOPES'],
              codeSyntax: {},
            },
          },
        },
      },
      color: {
        brand: {
          radish: {
            $type: 'color',
            $value: '#ffbe16',
            $description: 'Radish color',
            $extensions: {
              'com.figma': {
                hiddenFromPublishing: false,
                scopes: ['ALL_SCOPES'],
                codeSyntax: {},
              },
            },
          },
          pear: {
            $type: 'color',
            $value: '#ff0016',
            $description: 'Pear color',
            $extensions: {
              'com.figma': {
                hiddenFromPublishing: false,
                scopes: ['ALL_SCOPES'],
                codeSyntax: {},
              },
            },
          },
        },
      },
    })

    expect(tokenFiles['primitives.mode2.json']).toEqual({
      spacing: {
        '1': {
          $type: 'number',
          $value: 8,
          $description: '8px spacing',
          $extensions: {
            'com.figma': {
              hiddenFromPublishing: true,
              scopes: ['TEXT_CONTENT'],
              codeSyntax: { WEB: 'web', ANDROID: 'android' },
            },
          },
        },
        '2': {
          $type: 'number',
          $value: 16,
          $description: '16px spacing',
          $extensions: {
            'com.figma': {
              hiddenFromPublishing: false,
              scopes: ['ALL_SCOPES'],
              codeSyntax: {},
            },
          },
        },
      },
      color: {
        brand: {
          radish: {
            $type: 'color',
            $value: '#ffcbb7',
            $description: 'Radish color',
            $extensions: {
              'com.figma': {
                hiddenFromPublishing: false,
                scopes: ['ALL_SCOPES'],
                codeSyntax: {},
              },
            },
          },
          pear: {
            $type: 'color',
            $value: '#def358',
            $description: 'Pear color',
            $extensions: {
              'com.figma': {
                hiddenFromPublishing: false,
                scopes: ['ALL_SCOPES'],
                codeSyntax: {},
              },
            },
          },
        },
      },
    })
  })

  it('handles aliases', () => {
    const localVariablesResponse: GetLocalVariablesResponse = {
      status: 200,
      error: false,
      meta: {
        variableCollections: {
          'VariableCollectionId:1:1': {
            id: 'VariableCollectionId:1:1',
            name: 'collection1',
            modes: [
              { modeId: '1:0', name: 'mode1' },
              { modeId: '1:1', name: 'mode2' },
            ],
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
            key: 'variable_key1',
            variableCollectionId: 'VariableCollectionId:1:1',
            resolvedType: 'FLOAT',
            valuesByMode: {
              '1:0': 1,
            },
            remote: false,
            description: 'var1 description',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
          'VariableID:2:2': {
            id: 'VariableID:2:2',
            name: 'var2',
            key: 'variable_key2',
            variableCollectionId: 'VariableCollectionId:1:1',
            resolvedType: 'FLOAT',
            valuesByMode: {
              '1:0': { type: 'VARIABLE_ALIAS', id: 'VariableID:2:1' },
            },
            remote: false,
            description: 'var2 description',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
        },
      },
    }

    const tokenFiles = tokenFilesFromLocalVariables(localVariablesResponse)

    expect(tokenFiles['collection1.mode1.json']).toEqual({
      var1: {
        $type: 'number',
        $value: 1,
        $description: 'var1 description',
        $extensions: {
          'com.figma': {
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
        },
      },
      var2: {
        $type: 'number',
        $value: '{var1}',
        $description: 'var2 description',
        $extensions: {
          'com.figma': {
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
          },
        },
      },
    })
  })
})
