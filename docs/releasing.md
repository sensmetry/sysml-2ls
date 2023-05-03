# Releasing

## Prerequisites

Release jobs expect CI variables for `release` environment:

- `ACCESS_TOKEN` - project access token with `write_repository` scope and
  maintainer role (to allow commits straight to `main` branch). They can be
  created from `Settings > Access Tokens` in the [project repo
  page](https://gitlab.com/sensmetry/public/sysml-2ls/-/settings/access_tokens).
- `VSCE_PAT` - VS Code Marketplace [personal access
  token](https://learn.microsoft.com/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate).
- `OVSX_PAT` - Open VSX [personal access
  token](https://open-vsx.org/user-settings/tokens).
- `GH_ACCESS_TOKEN` - personal access token for our [GitHub
  mirror](https://github.com/sensmetry/sysml-2ls) with read and write access to
  contents for pushing and creating releases through API.

Personal access tokens expire so they will need to be recreated from time to
time.

## Triggering a Release

Release workflow is triggered by running a pipeline manually on the `main`
branch with `VERSION` variable from `CI/CD > Pipelines > Run pipeline`. The
workflow:

- Updates version fields
- Extracts latest changelog
- Commits the changes to the `main` branch
- Creates a tag `VERSION`
- Packages the plugin
- Pushes the changes
- Publishes the plugin:
  - Creates a release for `VERSION` tag
  - Publishes to VS Code Marketplace
  - Publishes to Open VSX Registry

The workflow is cancelled if any of these are true:

- `VERSION` is not a semantic version
- `VERSION` tag already exists
- `VERSION` is lower than `version` in `package.json`
- latest changelog section is for a different semantic version
