# variables-github-action-example

This repository contains a "Sync tokens to Figma" workflow for GitHub Actions that demonstrates syncing tokens from a set of json files in a codebase to variables in a Figma file.

The example tokens json files in `tokens/` are taken from the [Get started with variables](https://www.figma.com/community/file/1253086684245880517/Get-started-with-variables) Community file.

## Local development

You can run the GitHub action locally by first creating a `.env` file:

```
FILE_KEY="your_file_key"
ACCESS_TOKEN="your_personal_access_token"
```

and then running:

```sh
npm run sync-tokens-to-figma

# or

npm run sync-figma-to-tokens
```

## Testing

Run the Jest tests:

```sh
npm run test
```
