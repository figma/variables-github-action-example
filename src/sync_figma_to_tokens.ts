import 'dotenv/config'
import * as fs from 'fs'

import FigmaApi from './figma_api.js'

import { green } from './utils.js'
import { tokenFilesFromLocalVariables } from './token_export.js'

async function main() {
  if (!process.env.PERSONAL_ACCESS_TOKEN || !process.env.FILE_KEY) {
    throw new Error('PERSONAL_ACCESS_TOKEN and FILE_KEY environemnt variables are required')
  }
  const fileKey = process.env.FILE_KEY

  const api = new FigmaApi(process.env.PERSONAL_ACCESS_TOKEN)
  const localVariables = await api.getLocalVariables(fileKey)

  const tokensFiles = tokenFilesFromLocalVariables(localVariables)

  const OUTPUT_DIR = 'tokens_new'

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR)
  }

  Object.entries(tokensFiles).forEach(([fileName, fileContent]) => {
    fs.writeFileSync(`${OUTPUT_DIR}/${fileName}`, JSON.stringify(fileContent, null, 2))
    console.log(`Wrote ${fileName}`)
  })

  console.log(green(`✅ Tokens files have been written to the ${OUTPUT_DIR} directory`))
}

main()
