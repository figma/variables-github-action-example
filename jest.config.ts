import type { Config } from 'jest'

const config: Config = {
  verbose: true,
  //transform: {},
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
}

export default config
