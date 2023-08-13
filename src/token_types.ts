import { VariableCodeSyntax, VariableScope } from './figma_api.js'

export interface Token {
  $type: 'color' | 'number' | 'string' | 'boolean'
  $value: string | number | boolean
  $description?: string
  $extensions?: {
    'com.figma'?: {
      hiddenFromPublishing?: boolean
      scopes?: VariableScope[]
      codeSyntax?: VariableCodeSyntax
    }
  }
}

export type TokenOrTokenGroup =
  | Token
  | ({
      [tokenName: string]: Token
    } & { $type?: never; $value?: never })

export type TokensFile = {
  [key: string]: TokenOrTokenGroup
}
