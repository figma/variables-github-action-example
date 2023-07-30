import * as fs from 'fs'
import * as path from 'path'

import FigmaApi, {
  VariableCollection,
  Variable,
  ApiPostVariablesPayload,
  VariableValue,
} from './figma_api.js'
import { colorApproximatelyEqual, parseColor } from './color.js'

export interface Token {
  $type: 'color' | 'number' | 'string' | 'boolean'
  $value: string | number | boolean
}

export type TokenOrTokenGroup =
  | Token
  | ({
      [tokenName: string]: Token
    } & { $type?: never; $value?: never })

export type TokensFile = {
  [key: string]: TokenOrTokenGroup
}

export function readJsonFiles(files: string[]) {
  const tokensJsonByFile: {
    [fileName: string]: {
      [tokenName: string]: Token
    }
  } = {}

  files.forEach((file) => {
    const fileContent = fs.readFileSync(file, { encoding: 'utf-8' })
    const tokensFile: TokensFile = JSON.parse(fileContent)
    tokensJsonByFile[file] = flattenTokensFile(tokensFile)
  })

  return tokensJsonByFile
}

function flattenTokensFile(tokensFile: TokensFile) {
  const flattenedTokens: { [tokenName: string]: Token } = {}

  Object.entries(tokensFile).forEach(([tokenGroup, groupValues]) => {
    traverseCollection({ key: tokenGroup, object: groupValues, tokens: flattenedTokens })
  })

  return flattenedTokens
}

function traverseCollection({
  key,
  object,
  tokens,
}: {
  key: string
  object: TokenOrTokenGroup
  tokens: { [tokenName: string]: Token }
}) {
  // if key is a meta field, move on
  if (key.charAt(0) === '$') {
    return
  }

  if (object.$value !== undefined) {
    tokens[key] = object
  } else {
    Object.entries<TokenOrTokenGroup>(object).forEach(([key2, object2]) => {
      if (key2.charAt(0) !== '$' && typeof object2 === 'object') {
        traverseCollection({
          key: `${key}/${key2}`,
          object: object2,
          tokens,
        })
      }
    })
  }
}

function collectionAndModeFromFileName(fileName: string) {
  const [collectionName, modeName] = fileName.split('.')
  return { collectionName, modeName }
}

function variableResolvedTypeFromToken(token: Token) {
  switch (token.$type) {
    case 'color':
      return 'COLOR'
    case 'number':
      return 'FLOAT'
    case 'string':
      return 'STRING'
    case 'boolean':
      return 'BOOLEAN'
  }
}

function isAlias(value: string) {
  return value.toString().trim().charAt(0) === '{'
}

function variableValueFromToken(
  token: Token,
  localVariablesByCollectionAndName: {
    [variableCollectionId: string]: { [variableName: string]: Variable }
  },
): VariableValue {
  if (typeof token.$value === 'string' && isAlias(token.$value)) {
    const value = token.$value
      .trim()
      .replace(/\./g, '/')
      .replace(/[\{\}]/g, '')

    for (const localVariablesByName of Object.values(localVariablesByCollectionAndName)) {
      if (localVariablesByName[value]) {
        return {
          type: 'VARIABLE_ALIAS',
          id: localVariablesByName[value].id,
        }
      }
    }

    return {
      type: 'VARIABLE_ALIAS',
      id: value,
    }
  } else if (typeof token.$value === 'string' && token.$type === 'color') {
    const color = parseColor(token.$value)
    color.r = Math.round(color.r * 1000) / 1000
    color.g = Math.round(color.g * 1000) / 1000
    color.b = Math.round(color.b * 1000) / 1000
    return color
  } else {
    return token.$value
  }
}

function compareVariableValues(a: VariableValue, b: VariableValue) {
  if (typeof a === 'object' && typeof b === 'object') {
    if ('type' in a && 'type' in b && a.type === 'VARIABLE_ALIAS' && b.type === 'VARIABLE_ALIAS') {
      return a.id === b.id
    } else if ('r' in a && 'r' in b) {
      return colorApproximatelyEqual(a, b)
    }
  } else {
    return a === b
  }

  return false
}

export async function generatePostVariablesPayload(
  tokensByFile: {
    [fileName: string]: {
      [tokenName: string]: Token
    }
  },
  accessToken: string,
  fileKey: string,
) {
  const api = new FigmaApi(accessToken)
  const localVariables = await api.getLocalVariables(fileKey)

  const localVariableCollectionsByName: { [name: string]: VariableCollection } = {}
  const localVariablesByCollectionAndName: {
    [variableCollectionId: string]: { [variableName: string]: Variable }
  } = {}

  Object.values(localVariables.meta.variableCollections).forEach((collection) => {
    // Skip over remote collections because we can't modify them
    if (collection.remote) {
      return
    }

    if (localVariableCollectionsByName[collection.name]) {
      throw new Error(`Duplicate variable collection in file: ${collection.name}`)
    }

    localVariableCollectionsByName[collection.name] = collection
  })

  Object.values(localVariables.meta.variables).forEach((variable) => {
    // Skip over remote variables because we can't modify them
    if (variable.remote) {
      return
    }

    if (!localVariablesByCollectionAndName[variable.variableCollectionId]) {
      localVariablesByCollectionAndName[variable.variableCollectionId] = {}
    }

    localVariablesByCollectionAndName[variable.variableCollectionId][variable.name] = variable
  })

  console.log(
    'Local variable collections in Figma file:',
    Object.keys(localVariableCollectionsByName),
  )

  const postVariablesPayload: ApiPostVariablesPayload = {
    variableCollections: [],
    variableModes: [],
    variables: [],
    variableModeValues: [],
  }

  Object.entries(tokensByFile).forEach(([fileName, tokens]) => {
    const { collectionName, modeName } = collectionAndModeFromFileName(path.basename(fileName))

    const variableCollection = localVariableCollectionsByName[collectionName]
    const variableCollectionId = variableCollection ? variableCollection.id : collectionName
    const variableMode = variableCollection?.modes.find((mode) => mode.name === modeName)
    const modeId = variableMode ? variableMode.modeId : modeName

    if (
      !variableCollection &&
      !postVariablesPayload.variableCollections!.find((c) => c.id === variableCollectionId)
    ) {
      postVariablesPayload.variableCollections!.push({
        action: 'CREATE',
        id: variableCollectionId,
        name: variableCollectionId,
        initialModeId: modeId,
      })

      postVariablesPayload.variableModes!.push({
        action: 'UPDATE',
        id: modeId,
        name: modeId,
        variableCollectionId,
      })
    }

    if (
      !variableMode &&
      !postVariablesPayload.variableCollections!.find(
        (c) => c.id === variableCollectionId && c.initialModeId === modeId,
      )
    ) {
      postVariablesPayload.variableModes!.push({
        action: 'CREATE',
        id: modeId,
        name: modeId,
        variableCollectionId,
      })
    }

    const localVariablesByName = localVariablesByCollectionAndName[variableCollection?.id] || {}

    Object.entries(tokens).forEach(([tokenName, token]) => {
      const variable = localVariablesByName[tokenName]
      const variableId = variable ? variable.id : tokenName

      if (
        !variable &&
        !postVariablesPayload.variables!.find(
          (v) => v.id === variableId && v.variableCollectionId === variableCollectionId,
        )
      ) {
        postVariablesPayload.variables!.push({
          action: 'CREATE',
          id: variableId,
          name: tokenName,
          variableCollectionId,
          resolvedType: variableResolvedTypeFromToken(token),
        })
      }

      const existingVariableValue = variable && variableMode ? variable.valuesByMode[modeId] : null
      const newVariableValue = variableValueFromToken(token, localVariablesByCollectionAndName)

      if (
        existingVariableValue === null ||
        !compareVariableValues(existingVariableValue, newVariableValue)
      ) {
        postVariablesPayload.variableModeValues!.push({
          variableId,
          modeId,
          value: newVariableValue,
        })
      }
    })
  })

  return postVariablesPayload
}
