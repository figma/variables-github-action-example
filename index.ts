import 'dotenv/config'
import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'

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

interface VariableMode {
  id: string
  name: string
}

interface VariableCollection {
  id: string
  name: string
  modes: VariableMode[]
  defaultModeId: string
  remote: boolean
}

interface Color {
  r: number
  g: number
  b: number
  a: number
}

interface VariableAlias {
  type: 'VARIABLE_ALIAS'
  id: string
}

interface Variable {
  id: string
  name: string
  key: string
  variableCollectionId: string
  resolvedType: 'BOOLEAN' | 'FLOAT' | 'STRING' | 'COLOR'
  valuesByMode: { [modeId: string]: boolean | number | string | Color | VariableAlias }
  remote: boolean
}

interface ApiGetLocalVariablesResponse {
  status: number
  error: boolean
  meta: {
    variableCollections: { [id: string]: VariableCollection }
    variables: { [id: string]: Variable }
  }
}

class FigmaApi {
  private baseUrl = 'https://api.figma.com'
  private token: string

  constructor(token: string) {
    this.token = token
  }

  async getLocalVariables(fileKey: string) {
    const resp = await axios.request<ApiGetLocalVariablesResponse>({
      url: `${this.baseUrl}/v1/files/${fileKey}/variables/local`,
      headers: {
        Accept: '*/*',
        'X-Figma-Token': this.token,
      },
    })

    return resp.data
  }

  async postVariables(fileKey: string, payload: any) {
    const resp = await axios.request({
      url: `${this.baseUrl}/v1/files/${fileKey}/variables`,
      method: 'POST',
      headers: {
        Accept: '*/*',
        'X-Figma-Token': this.token,
      },
      data: payload,
    })

    return resp.data
  }
}

const TOKENS_DIR = 'tokens'
const tokensFiles = fs.readdirSync(TOKENS_DIR).map((file: string) => `${TOKENS_DIR}/${file}`)
console.log('tokensFiles', tokensFiles)

function readJsonFiles(files: string[]) {
  const tokensJsonByFile: { [fileName: string]: TokensFile } = {}

  files.forEach((file) => {
    const fileContent = fs.readFileSync(file, { encoding: 'utf-8' })
    tokensJsonByFile[file] = JSON.parse(fileContent)
  })

  return tokensJsonByFile
}

function collectionAndModeFromFileName(fileName: string) {
  const [collection, mode] = fileName.split('.')
  return { collection, mode }
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

  const tokensJsonByFile = readJsonFiles(tokensFiles)

  console.log(tokensJsonByFile)

  Object.entries(tokensJsonByFile).forEach(([fileName, tokensFile]) => {
    const { collection, mode } = collectionAndModeFromFileName(path.basename(fileName))
    console.log(collection, mode)

    const flattenedTokens = flattenTokensFile(tokensFile)
    console.log(flattenedTokens)
  })

  const api = new FigmaApi(process.env.ACCESS_TOKEN)
  const localVariables = await api.getLocalVariables(fileKey)
  console.log('localVariables', localVariables)

  return

  // Change the arguments here to generate a bigger or smaller payload
  // const payload = {
  //   variableCollections: [
  //     {
  //       action: 'CREATE',
  //       id: `my_variable_collection`,
  //       name: `New Variable Collection`,
  //     },
  //   ],
  // }

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
