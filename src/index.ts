import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'

import FigmaApi, { VariableCollection, Variable, ApiPostVariablesPayload } from './figma_api.js'

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

async function main() {
  if (!process.env.ACCESS_TOKEN || !process.env.FILE_KEY) {
    throw new Error('ACCESS_TOKEN environemnt variable is required')
  }
  const fileKey = process.env.FILE_KEY

  const TOKENS_DIR = 'tokens'
  const tokensFiles = fs.readdirSync(TOKENS_DIR).map((file: string) => `${TOKENS_DIR}/${file}`)

  const tokensByFile = readJsonFiles(tokensFiles)

  console.log(tokensByFile)

  const api = new FigmaApi(process.env.ACCESS_TOKEN)
  const localVariables = await api.getLocalVariables(fileKey)
  console.log('localVariables', localVariables)

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

  console.log('localVariableCollectionsByName', localVariableCollectionsByName)

  const postVariablesPayload: ApiPostVariablesPayload = {
    variableCollections: [],
    variableModes: [],
    variables: [],
    variableModeValues: [],
  }

  Object.entries(tokensByFile).forEach(([fileName, tokens]) => {
    const { collectionName, modeName } = collectionAndModeFromFileName(path.basename(fileName))
    console.log(collectionName, modeName)

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

      postVariablesPayload.variableModeValues!.push({
        variableId,
        modeId,
        value: token.$value,
      })
    })
  })

  console.log('postVariablesPayload.variableCollections', postVariablesPayload.variableCollections)
  console.log('postVariablesPayload.variableModes', postVariablesPayload.variableModes)
  console.log('postVariablesPayload.variables', postVariablesPayload.variables)
  console.log('postVariablesPayload.variableModeValues', postVariablesPayload.variableModeValues)

  // const start = Date.now()
  // const apiResp = await axios.request({
  //   url: `${baseUrl}/v1/files/${fileKey}/variables`,
  //   method: 'POST',
  //   headers: {
  //     Accept: '*/*',
  //     'X-Figma-Token': token,
  //   },
  //   data: payload,
  // })

  // console.log(apiResp.data)
  // console.log('elapsed time:', Date.now() - start)
}

main()
