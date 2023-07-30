import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'

import FigmaApi, {
  VariableCollection,
  Variable,
  ApiPostVariablesPayload,
  VariableValue,
  Color,
} from './figma_api.js'

import { parseColor } from './color.js'
import { green } from './utils.js'

interface Token {
  $type: 'color' | 'number' | 'string' | 'boolean'
  $value: string | number | boolean
}

type TokenOrTokenGroup =
  | Token
  | ({
      [tokenName: string]: Token
    } & { $type?: never; $value?: never })

type TokensFile = {
  [key: string]: TokenOrTokenGroup
}

function readJsonFiles(files: string[]) {
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

function collectionAndModeFromFileName(fileName: string) {
  const [collectionName, modeName] = fileName.split('.')
  return { collectionName, modeName }
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
      if (key2.charAt(0) !== '$') {
        traverseCollection({
          key: `${key}/${key2}`,
          object: object2,
          tokens,
        })
      }
    })
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

/**
 * Compares two colors for approximate equality since converting between Figma RGBA objects (from 0 -> 1) and
 * hex colors can result in slight differences.
 */
function colorApproximatelyEqual(colorA: Color, colorB: Color) {
  const EPSILON = 0.002

  return (
    Math.abs(colorA.r - colorB.r) < EPSILON &&
    Math.abs(colorA.g - colorB.g) < EPSILON &&
    Math.abs(colorA.b - colorB.b) < EPSILON &&
    Math.abs((colorA.a === undefined ? 1 : colorA.a) - (colorB.a === undefined ? 1 : colorB.a)) <
      EPSILON
  )
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

async function main() {
  if (!process.env.ACCESS_TOKEN || !process.env.FILE_KEY) {
    throw new Error('ACCESS_TOKEN environemnt variable is required')
  }
  const fileKey = process.env.FILE_KEY

  const TOKENS_DIR = 'tokens'
  const tokensFiles = fs.readdirSync(TOKENS_DIR).map((file: string) => `${TOKENS_DIR}/${file}`)

  const tokensByFile = readJsonFiles(tokensFiles)

  console.log('Read tokens files:', Object.keys(tokensByFile))

  const api = new FigmaApi(process.env.ACCESS_TOKEN)
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

    if (!variableCollection) {
      postVariablesPayload.variableCollections!.push({
        action: 'CREATE',
        id: variableCollectionId,
        name: variableCollectionId,
        initialModeId: modeId,
      })
    }

    if (!variableMode) {
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

      if (!variable) {
        postVariablesPayload.variables!.push({
          action: 'CREATE',
          id: variableId,
          name: tokenName,
          variableCollectionId,
          resolvedType: token.$type.toUpperCase() as any,
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

  if (Object.values(postVariablesPayload).every((value) => value.length === 0)) {
    console.log(green('✅ Tokens are already up to date with the Figma file'))
    return
  }

  const apiResp = await api.postVariables(fileKey, postVariablesPayload)

  console.log('POST variables API response:', apiResp)

  if (postVariablesPayload.variableCollections && postVariablesPayload.variableCollections.length) {
    console.log('Updated variable collections', postVariablesPayload.variableCollections)
  }

  if (postVariablesPayload.variableModes && postVariablesPayload.variableModes.length) {
    console.log('Updated variable modes', postVariablesPayload.variableModes)
  }

  if (postVariablesPayload.variables && postVariablesPayload.variables.length) {
    console.log('Updated variables', postVariablesPayload.variables)
  }

  if (postVariablesPayload.variableModeValues && postVariablesPayload.variableModeValues.length) {
    console.log('Updated variable mode values', postVariablesPayload.variableModeValues)
  }

  console.log(green('✅ Figma file has been updated with the new tokens'))
}

main()
