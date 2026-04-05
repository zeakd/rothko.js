# rothko.js

*What color is your landscape?*

Monorepo for [rothko](./packages/rothko/) — perceptual color palette extraction from images.

## Packages

| Package | Description |
|---------|-------------|
| [rothko](./packages/rothko/) | Core library. Zero dependencies, ESM, TypeScript. |

## Development

```bash
npm install
npm run build
npm run typecheck
```

## Release

Managed by [changesets](https://github.com/changesets/changesets). Push to `master` triggers the release workflow.

```bash
npx changeset        # create a changeset
git push             # triggers "Version Packages" PR
                     # merge PR → npm publish (OIDC provenance)
```
