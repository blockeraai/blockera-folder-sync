# blockera-folder-sync
`blockera-folder-sync` is a GitHub Action for syncing shared packages across multiple repositories. This is especially useful when you have shared packages or folders and need to ensure all dependent repositories are updated whenever changes are pushed to the master branch.

## Features
- Automatically sync shared packages across repositories.
- Triggered on changes to the master branch of the primary repository.
- Easily configurable with repository secrets for authentication.

## Usage
Below is an example workflow configuration to sync shared packages with dependent repositories:

### Example Workflow

``name: Sync Packages to Other Repos

on:
push:
branches:
- master

jobs:
sync-packages:
name: Sync Packages to Other Repos
runs-on: ubuntu-latest

        steps:
            - name: Checkout Primary Repo
              uses: actions/checkout@v4

            - name: Sync packages with other dependent repositories
              uses: blockeraai/blockera-folder-sync@v1.0.0
              with:
                  TOKEN: ${{ secrets.BLOCKERABOT_PAT }}
                  USERNAME: ${{ secrets.BLOCKERABOT_USERNAME }}
                  EMAIL: ${{ secrets.BLOCKERABOT_EMAIL }}``

## Inputs

| Name       | Required | Description                                            |
|------------|----------|--------------------------------------------------------|
| `TOKEN`    | Yes      | Personal Access Token (PAT) for authentication.        |
| `USERNAME` | Yes      | Username of the bot or user performing the sync.       |
| `EMAIL`    | Yes      | Email address for the bot or user performing the sync. |

## Setup
1. Create a Personal Access Token (PAT):
    Go to your GitHub account settings and generate a PAT with the necessary repository permissions.
2. Add Secrets to Your Repository:
   - Navigate to your repository Settings > Secrets and variables > Actions > New repository secret.
   - Add the following secrets:
     - `BLOCKERABOT_PAT` - Your PAT.
     - `BLOCKERABOT_USERNAME` - Your GitHub username.
     - `BLOCKERABOT_EMAIL` - Your GitHub email.

3. Configure the Workflow:
- Copy the example workflow above into your `.github/workflows/sync-packages.yml` file.

## Example Scenarios
- Syncing shared libraries across microservices repositories.
- Propagating changes in a monorepo structure to other repositories.

## License
This project is licensed under the MIT License.

## Contributing
We welcome contributions! Feel free to open issues or submit pull requests to improve this Action.

