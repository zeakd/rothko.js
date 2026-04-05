---
"rothko": minor
---

Rewrite to modern ESM TypeScript with S38 MMR Points strategy

- `createRothko()` factory API with `extract` (async) and `extractSync`
- Zero dependencies, OkLAB/OKLCH perceptual color space
- `rothko/dom` browser utility (`readPixels` via OffscreenCanvas)
- Entropy-adaptive sensitivity, Hunt effect, Silverman bandwidth, MMR point selection
