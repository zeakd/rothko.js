export type RGB = [number, number, number]; // 0-255
export type OKLCH = [number, number, number]; // L:0-1, C:0-0.4, H:0-360
export type OkLAB = [number, number, number]; // L:0-1, a/b: -0.4~0.4

/** 내부 strategy 출력용 (public API 아님) */
export interface RawColor {
  rgb: RGB;
  rate: number;
  imageRate: number;
}

/** @internal */
export interface RawPalette {
  dominants: RawColor[];
  chromas: RawColor[];
  achromas: RawColor[];
  points: RawColor[];
}

export type Strategy = (pixels: Uint8Array) => RawPalette;

// ---------- Public API types ----------

/** 추출된 색상. hex, rgb, oklch 모두 포함. */
export interface Color {
  hex: string;
  rgb: RGB;
  oklch: OKLCH;
  rate: number; // 팔레트 내 비율 (0~1)
  coverage: number; // 이미지 전체 대비 비율 (0~1)
}

/** 팔레트 결과. */
export interface Palette {
  dominants: Color[];
  chromas: Color[];
  achromas: Color[];
  points: Color[];
}

/** createRothko 설정. v1에서는 빈 객체, 향후 확장용. */
export interface RothkoConfig {}
