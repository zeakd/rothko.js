# rothko

## 0.2.0

### Minor Changes

- [`fbb3f5e`](https://github.com/zeakd/rothko.js/commit/fbb3f5ec55072ba438fa8a8fc5b7290d7e394cbe) Thanks [@zeakd](https://github.com/zeakd)! - Rewrite to modern ESM TypeScript with S38 MMR Points strategy

  - `createRothko()` factory API with `extract` (async) and `extractSync`
  - Zero dependencies, OkLAB/OKLCH perceptual color space
  - `rothko/dom` browser utility (`readPixels` via OffscreenCanvas)
  - Entropy-adaptive sensitivity, Hunt effect, Silverman bandwidth, MMR point selection
