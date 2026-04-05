# rothko

## 0.2.0

### Minor Changes

- [`c93b583`](https://github.com/zeakd/rothko.js/commit/c93b583625b2348dff0a0adc8a3437c52bfbd772) Thanks [@zeakd](https://github.com/zeakd)! - Rewrite to modern ESM TypeScript with S38 MMR Points strategy

  - `createRothko()` factory API with `extract` (async) and `extractSync`
  - Zero dependencies, OkLAB/OKLCH perceptual color space
  - `rothko/dom` browser utility (`readPixels` via OffscreenCanvas)
  - Entropy-adaptive sensitivity, Hunt effect, Silverman bandwidth, MMR point selection
