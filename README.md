# variables-github-action-example

This repository contains a couple of GitHub Actions workflows:

- Sync tokens to Figma
- Sync Figma variables to tokens

These workflows demonstrate bi-directional syncing between variables in Figma and design tokens in a codebase using Figma's [Variables REST API](https://www.figma.com/developers/api#variables). For more background and a graphical representation of what these workflows do, see our [Syncing design systems using Variables REST API](https://www.figma.com/community/file/1270821372236564565) FigJam file.

To use these workflows, you should copy the code in this repository into your organization and modify it to suit the needs of your design processes.

## Prerequisites

To use the "Sync Figma variables to tokens" workflow, you must be a full member of an Enterprise org in Figma. To use the "Sync tokens to Figma" workflow, you must also have an editor seat.

Both workflows assume that you have a single Figma file with local variable collections, along with one or more tokens json files in the `tokens/` directory that adhere\* to the [draft W3C spec for Design Tokens](https://tr.designtokens.org/format/). For demonstration purposes, this directory contains the tokens exported from the [Get started with variables](https://www.figma.com/community/file/1253086684245880517/Get-started-with-variables) Community file. Have a copy of this file ready if you want to try out the workflow with these existing tokens.

> \*See `src/token_types.ts` for more details on the format of the expected tokens json files, including the deviations from the draft design tokens spec we've had to make. **We expect there to be one tokens file per variable collection and mode.**

In addition, you must also have a [personal access token](https://www.figma.com/developers/api#access-tokens) for the Figma API to allow these workflows to authenticate with the API. For the "Sync Figma variables to tokens" workflow, the token must have at least the Read-only Variables scope selected. For the "Sync tokens to Figma" workflow, the token must have the Read and write Variables scope selected.

## Usage

Before running either of these workflows, you'll need to create an [encrypted secret](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository) in your repository named `GH_ACTION_VARIABLES_SYNC_FIGMA_TOKEN` containing your personal access token.

Both workflows are configured to [run manually](https://docs.github.com/en/actions/using-workflows/manually-running-a-workflow) for demonstration purposes, and are designed to be as conservative as possible in their functionality (see details below).

### Sync Figma variables to tokens

To run the "Sync Figma variables to tokens" workflow:

- Open the workflow under the **Actions** tab in your repository and click **Run workflow**
- You will be asked to provide the file key of the Figma file. The file key can be obtained from any Figma file URL: `https://www.figma.com/file/{file_key}/{title}`.
- After the workflow finishes, you should see a new pull request if there are changes to be made to the tokens files in the `tokens/` directory. If there are no changes to be made, then a pull request will not be created.

This workflow has some key behaviors to note:

- After generating the new tokens json files, this workflow creates a pull request for someone on the team to review. If you prefer, you can modify the workflow to commit directly to a designated branch without creating a pull request.
- If a variable collection or mode is removed from the Figma file, the corresponding tokens file will not be removed from the codebase.

### Sync tokens to Figma

To run the "Sync tokens to Figma" workflow:

- Open the workflow under the **Actions** tab in your repository and click **Run workflow**
- You will be asked to provide the file key of the Figma file. The file key can be obtained from any Figma file URL: `https://www.figma.com/file/{file_key}/{title}`. Note: if you are trying out this workflow for the first time, use a file that is separate from your design system to avoid any unintended changes.
- After the workflow finishes, open the file in Figma and observe that the variables should be updated to reflect the tokens in your tokens files.

This workflow has some key behaviors to note:

- Though this workflow is configured to run manually, you're free to modify it to run on code push to a specified branch once you are comfortable with its behavior.
- When syncing to a Figma file that does not have any variable collections, this workflow will add brand-new collections and variables. When syncing to a Figma file that has existing variable collections, this workflow will modify collections and variables **in-place** using name matching. That is, it will look for existing collections and variables by name, modify their properties and values if names match, and create new variables if names do not match.
- The workflow will not remove variables or variable collections that have been removed in your tokens files.
- When mapping aliases to existing local variables, we assume that variable names are unique _across all collections_ in the Figma file. Figma allows duplicate variable names across collections, so you should make sure that aliases don't have naming conflicts in your file.
- For optional Figma variable properties like scopes and code syntax, the workflow will not modify these properties in Figma if the tokens json files do not contain those properties.

## Local development

You can run the GitHub actions locally by running `npm install` and creating a `.env` file with the following contents:

```
FILE_KEY="your_file_key"
PERSONAL_ACCESS_TOKEN="your_personal_access_token"
```

and then running:

```sh
npm run sync-tokens-to-figma

# or

# Defaults to writing to the tokens_new directory
npm run sync-figma-to-tokens

# Writes to the specified directory
npm run sync-figma-to-tokens -- --output directory_name
```

### Testing

Run the Jest tests:

```sh
npm run test
```
