# rothko

*What color is your landscape?*

Extract perceptual color palettes from images. Zero dependencies.

```ts
import { createRothko } from "rothko";
import { readPixels } from "rothko/dom";

const { data } = await readPixels(image);
const palette = await createRothko().extract(data);
```

```json
{
  "dominants": [
    { "hex": "#4a6741", "oklch": [0.45, 0.08, 148.2], "coverage": 0.23 },
    { "hex": "#c4a882", "oklch": [0.74, 0.05, 76.1],  "coverage": 0.18 },
    { "hex": "#1a1a1e", "oklch": [0.15, 0.01, 264.5], "coverage": 0.12 }
  ],
  "points": [
    { "hex": "#d4533b", "oklch": [0.56, 0.17, 28.4],  "coverage": 0.03 }
  ]
}
```

## Install

```bash
npm install rothko
```

## Usage

### Browser

```ts
import { createRothko } from "rothko";
import { readPixels } from "rothko/dom";

const rothko = createRothko();
const { data } = await readPixels(document.querySelector("img"));
const palette = await rothko.extract(data);

for (const color of palette.dominants) {
  console.log(color.hex, color.coverage);
}
```

`readPixels` accepts `HTMLImageElement`, `HTMLCanvasElement`, `ImageBitmap`, or `Blob`.

### Node.js

The core takes raw RGBA `Uint8Array`. Use any image library to decode pixels:

```ts
import { createRothko } from "rothko";
import sharp from "sharp"; // or any image decoder

const { data, info } = await sharp("photo.jpg")
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const palette = createRothko().extractSync(new Uint8Array(data.buffer));
```

Works with any source that produces RGBA bytes — `sharp`, `@napi-rs/canvas`, `jimp`, raw buffers, etc.

### extract vs extractSync

- **`extract(pixels)`** — yields to the main thread before processing. Use in browsers to keep UI responsive.
- **`extractSync(pixels)`** — synchronous. Use in workers, server-side, or when you don't need to yield.

## Output

Each color in the palette:

```ts
interface Color {
  hex: string;      // "#4a6741"
  rgb: RGB;         // [74, 103, 65]
  oklch: OKLCH;     // [L, C, H]
  rate: number;     // share within its group (0-1)
  coverage: number; // share of entire image (0-1)
}
```

Four groups:

- **dominants** — primary colors by visual weight
- **chromas** — chromatic subset of dominants
- **achromas** — achromatic subset (near-gray, black, white)
- **points** — accent colors distinct from dominants

## How it works

Histogram peak detection in OkLAB/OKLCH perceptual color space, with adaptive parameters derived from image statistics rather than fixed thresholds.

Stevens' power law maps image entropy to color sensitivity. The Hunt effect adjusts achromatic boundaries by luminance. Silverman bandwidth drives histogram smoothing. Dominant colors are selected by sector-aware ranking, then MMR (Maximal Marginal Relevance) picks accent points that are both relevant and diverse.

## License

MIT
