/**
 * createRothko — 팩토리 함수.
 * Rothko 인스턴스를 생성하고, extract()로 팔레트를 추출한다.
 */

import { strategy } from "./strategy.ts";
import { rgbToOklch } from "./color-spaces.ts";
import type { RothkoConfig, Palette, Color, RawColor, RGB } from "./types.ts";

function rgbToHex(rgb: RGB): string {
  return (
    "#" +
    rgb
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")
  );
}

function enrichColor(raw: RawColor): Color {
  const oklch = rgbToOklch(raw.rgb);
  return {
    hex: rgbToHex(raw.rgb),
    rgb: raw.rgb,
    oklch,
    rate: raw.rate,
    coverage: raw.imageRate,
  };
}

function enrichPalette(raw: ReturnType<typeof strategy>): Palette {
  return {
    dominants: raw.dominants.map(enrichColor),
    chromas: raw.chromas.map(enrichColor),
    achromas: raw.achromas.map(enrichColor),
    points: raw.points.map(enrichColor),
  };
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function createRothko(_config?: RothkoConfig) {
  function extractSync(pixels: Uint8Array): Palette {
    return enrichPalette(strategy(pixels));
  }

  async function extract(pixels: Uint8Array): Promise<Palette> {
    await yieldToMain();
    return extractSync(pixels);
  }

  return { extract, extractSync };
}
