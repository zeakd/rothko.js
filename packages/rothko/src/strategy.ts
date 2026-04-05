/**
 * Strategy 38: MMR Points
 *
 * S37 파이프라인 (Stage 1~5 동일) + Stage 6 포인트를 MMR 기반으로 통합.
 *
 * S37의 포인트 추출은 4채널(6a/6b/6b-R/6c)이 직렬 실행되어
 * 실행 순서가 암시적 우선순위가 되는 구조적 문제가 있었다.
 *
 * S38은 Maximal Marginal Relevance [Carbonell & Goldstein 1998]를 적용:
 * - 3개 소스(HighSat/Residual/SectorVivid)에서 후보를 하나의 풀로 수집
 * - 통합 Relevance: novelty × vividness × mass
 * - MMR greedy selection: λ×Rel - (1-λ)×maxSim → 다양성 자동 보장
 * - Explicit dedup 규칙 불필요 — MMR diversity term이 대체
 *
 * 나머지: Stevens, Hunt, Silverman, identity distance, collinear test 모두 S37과 동일.
 */

import type { OkLAB, OKLCH, RGB, RawPalette, RawColor, Strategy } from "./types.ts";
import {
  rgbToOklab, rgbToOklch, rgbToOklabAndOklch, oklchToRgb,
  colorDifferenceOklab,
} from "./color-spaces.ts";
import { CircularHistogram1D, Histogram1D, Histogram2D } from "./histogram.ts";

// ==========================================
// Constants — all derived from perceptual science
// ==========================================

/** OkLab Just-Noticeable Difference [Ottosson 2020] */
const JND = 0.02;

// ----- Histogram bins -----
const HUE_BINS = 360;
const L_BINS = 100;
const C_BINS = 80;
const C_SCALE = 250;

// ----- Luminance bounds -----
/** Dark adaptation limit [Hunt 2004] */
const L_LO = 0.10;
/** White point limit [Fairchild 2013] */
const L_HI = 0.93;

// ----- Stevens' power law -----
/** Maximum sensitivity at H=0 — amplitude of Stevens' curve.
 *  3.2 yields mergeDist ≈ 2.5 JND at mid-entropy (H≈0.5),
 *  matching the "noticeable" threshold on Weber fraction scale. */
const S_MAX = 3.2;
/** Rate-distortion concavity [Tirandaz, Sci Rep 2023] */
const ALPHA = 0.6;

// ----- Hunt effect -----
/** Achromatic base: 1.2 × JND ≈ CIELAB ΔE 2.3 */
const ACHROMA_BASE = 0.024;
/** Luminance-adaptive coefficient [Hunt 1975] */
const HUNT_K = 0.5;
/** Minimum floor (tuned for desert-dunes C≈0.03, ukiyoe gray C≈0.038) */
const ACHROMA_FLOOR = 0.028;

// ----- Memory color -----
/** Preferred reproduction chroma boost [Bartleson 1960, Fedorovskaya 1997] */
const CHROMA_BOOST = 1.15;

// ----- Selection -----
/** Munsell 10 hue families [Munsell] */
const SECTOR_SIZE = 36;
/** Max dominants per sector (10 sectors × 2 = 20 capacity, capped by MAX_DOMINANTS) */
const MAX_PER_SECTOR = 2;
/** Miller's Law 7±2 upper bound [Miller 1956] */
const MAX_DOMINANTS = 12;
const MIN_DOMINANTS = 3;
const MAX_FILL_SECTOR = 3;  // new-sector fills (Pass 2a)
const MAX_FILL_IDENTITY = 2; // identity-distinct rescues (Pass 2b)

// ----- Ricco's law (contrast-density tradeoff) -----
/** Reference threshold for contrast ratio [Ricco 1877] */
const RICCO_REF = 5 * JND; // = accentThreshold
/** Minimum density floor (prevents single-pixel noise) */
const RICCO_DENSITY_FLOOR = 0.0002; // 0.02%

// ----- HighSat -----
const HIGHSAT_ABSOLUTE_MIN = 0.06;

// ==========================================
// Types
// ==========================================

interface PixelOklch {
  oklch: OKLCH;
  oklab: OkLAB;
  rgb: RGB;
}

interface AdaptiveBounds {
  achromaC: number;
  highSatC: number;
  enableHighSat: boolean;
}

interface ColorCandidate {
  rgb: RGB;
  oklab: OkLAB;
  oklch: OKLCH;
  size: number;
  imageRate: number;
}

// ==========================================
// Identity distance (OKLCH component-wise)
// ==========================================

/**
 * Color identity distance: "같은 색인가?"
 *
 * Munsell/CIEDE2000 논리: H, C, L 세 축을 독립 평가.
 * max(ΔL/kL, ΔC/kC, ΔH_arc/kH)를 반환 — 하나라도 다르면 다른 색.
 *
 * kL, kC, kH는 각 축의 JND 스케일에서 도출:
 * - kL = JND (lightness JND ≈ 0.02 in OkLab)
 * - kC = JND × 0.75 (chroma change is more noticeable than lightness [Luo 2006])
 * - kH = JND × 0.8 (hue arc at given chroma)
 *
 * OkLab 대비 장점: chroma 민감도가 hue 각도와 무관하게 일관적.
 * OkLab Chebyshev는 hue=45°에서 채도 감도가 30% 떨어지는 문제가 있다.
 *
 * 반환값: JND 단위의 identity distance. 1.0 = 1 JND.
 */
function identityDistance(a: OKLCH, b: OKLCH): number {
  const kL = JND;
  const kC = JND * 0.75;

  const dL = Math.abs(a[0] - b[0]) / kL;
  const dC = Math.abs(a[1] - b[1]) / kC;

  // Hue arc distance (degrees → OkLab-scale distance)
  // At mean chroma, ΔH_arc ≈ meanC × Δhue_rad
  // kH=0.8×JND: 25° shift at C=0.12 → dH=3.19 (splits red/brown)
  //             15° shift at C=0.12 → dH=1.91 (merges within hue family)
  let dHdeg = Math.abs(a[2] - b[2]);
  if (dHdeg > 180) dHdeg = 360 - dHdeg;
  const meanC = (a[1] + b[1]) / 2;
  const dHarc = meanC * (dHdeg * Math.PI / 180); // arc length in OkLab units
  const kH = JND * 0.8;
  const dH = dHarc / kH;

  return Math.max(dL, dC, dH);
}

// ==========================================
// Entropy → Sensitivity (Stevens' power law)
// ==========================================

function computeEntropy(data: OkLAB[]): number {
  const BINS = 12;
  const TOTAL_BINS = BINS * BINS * BINS; // 1728
  const counts = new Uint32Array(TOTAL_BINS);
  for (const p of data) {
    const li = Math.min(BINS - 1, Math.max(0, Math.floor(p[0] * BINS)));
    const ai = Math.min(BINS - 1, Math.max(0, Math.floor((p[1] + 0.4) / 0.8 * BINS)));
    const bi = Math.min(BINS - 1, Math.max(0, Math.floor((p[2] + 0.4) / 0.8 * BINS)));
    counts[li * BINS * BINS + ai * BINS + bi]++;
  }
  const total = data.length;
  let entropy = 0;
  for (let i = 0; i < TOTAL_BINS; i++) {
    if (counts[i] > 0) {
      const p = counts[i] / total;
      entropy -= p * Math.log2(p);
    }
  }
  return Math.min(1, entropy / Math.log2(TOTAL_BINS));
}

/**
 * Stevens' power law: S(H) = S_MAX × (1 - H)^α
 *
 * Unlike S23's linear formula (3.5 - 2.0H), this follows the
 * perceptual magnitude scaling law where discrimination ability
 * decreases as a power function of stimulus complexity.
 *
 * H=0 (monochrome): S=3.5, high sensitivity
 * H=0.5 (moderate): S≈2.31
 * H=1 (maximum):    S≈0
 */
function computeSensitivity(normalizedEntropy: number): number {
  return S_MAX * Math.pow(Math.max(0, 1 - normalizedEntropy), ALPHA);
}

// ==========================================
// Adaptive bounds (Hunt effect)
// ==========================================

/**
 * Hunt effect: low luminance suppresses chroma perception.
 * achromaC = ACHROMA_BASE × (1 + HUNT_K × (1 - meanL))
 *
 * meanL ≈ 0.5 → achromaC ≈ 0.030
 * meanL ≈ 0.2 → achromaC ≈ 0.034 (dark: higher threshold)
 * meanL ≈ 0.8 → achromaC ≈ 0.028 (bright: floor takes over)
 */
function computeAdaptiveBounds(chromas: number[], S: number, meanL: number): AdaptiveBounds {
  const huntFactor = 1 + HUNT_K * (1 - meanL);
  const achromaC = Math.max(ACHROMA_FLOOR, ACHROMA_BASE * huntFactor);

  const sorted = [...chromas].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return { achromaC, highSatC: 0.15, enableHighSat: false };

  const trim = Math.max(1, Math.floor(n * 0.01));
  const trimmed = sorted.slice(trim, n - trim);
  const tn = trimmed.length;

  const P25 = trimmed[Math.floor(tn * 0.25)];
  const P75 = trimmed[Math.floor(tn * 0.75)];
  const P90 = trimmed[Math.floor(tn * 0.90)];
  const P95 = trimmed[Math.floor(tn * 0.95)];
  const IQR = P75 - P25;

  const highSatC = P90;
  const enableHighSat = IQR > S * JND * 2 || P95 > HIGHSAT_ABSOLUTE_MIN;

  return { achromaC, highSatC, enableHighSat };
}

// ==========================================
// Silverman bandwidth → smoothing parameters
// ==========================================

/**
 * Silverman's rule for circular hue data [Silverman 1986, Mardia & Jupp 2000]
 *
 * Computes optimal Gaussian kernel bandwidth from hue distribution,
 * then converts to smoothRepeat (number of σ=5° Gaussian passes).
 *
 * σ_eff = 5 × sqrt(repeat), so repeat = (bandwidth / 5)²
 *
 * Uses conservative 0.75 factor (Silverman assumes unimodal;
 * hue distributions are typically multimodal).
 */
function computeHueSmoothRepeat(chromaPixels: PixelOklch[]): number {
  const n = chromaPixels.length;
  if (n < 10) return 3;

  // Circular mean resultant length R [Mardia & Jupp 2000]
  let sumSin = 0, sumCos = 0;
  for (const px of chromaPixels) {
    const rad = px.oklch[2] * Math.PI / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
  }
  const R = Math.sqrt(sumSin * sumSin + sumCos * sumCos) / n;

  // Circular standard deviation (degrees)
  const circStdDeg = Math.sqrt(-2 * Math.log(Math.max(0.01, R))) * 180 / Math.PI;

  // Conservative Silverman (0.75 for multimodal hue data)
  const silvermanDeg = 0.75 * circStdDeg * Math.pow(n, -0.2);

  // Convert to smoothRepeat: σ_eff = 5 × sqrt(repeat)
  const repeat = Math.round((silvermanDeg / 5) ** 2);
  return Math.max(2, Math.min(8, repeat));
}

/**
 * Silverman's rule for linear L data [Silverman 1986]
 */
function computeLSmoothRepeat(achromaPixels: PixelOklch[]): number {
  const n = achromaPixels.length;
  if (n < 10) return 3;

  let sumL = 0;
  for (const px of achromaPixels) sumL += px.oklch[0];
  const meanL = sumL / n;
  let sumSq = 0;
  for (const px of achromaPixels) {
    const d = px.oklch[0] - meanL;
    sumSq += d * d;
  }
  const stdL = Math.sqrt(sumSq / Math.max(1, n - 1));
  const stdBins = stdL * (L_BINS - 1);

  const silvermanBins = 0.75 * stdBins * Math.pow(n, -0.2);
  const repeat = Math.round((silvermanBins / 5) ** 2);
  return Math.max(2, Math.min(8, repeat));
}

// ==========================================
// Pixel sampling
// ==========================================

function samplePixels(
  pixels: Uint8Array, totalPixels: number, maxSamples = 15000,
): PixelOklch[] {
  const total = totalPixels;
  const step = Math.max(1, Math.floor(total / maxSamples));
  const result: PixelOklch[] = [];

  for (let i = 0; i < total; i += step) {
    const offset = i * 4;
    if (pixels[offset + 3] < 128) continue;
    const rgb: RGB = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    const { oklab, oklch } = rgbToOklabAndOklch(rgb);
    if (isNaN(oklch[2])) oklch[2] = 0;
    result.push({ oklch, oklab, rgb });
  }
  return result;
}

// ==========================================
// Classify
// ==========================================

interface ClassifiedPixels {
  all: PixelOklch[];
  chroma: PixelOklch[];
  achroma: PixelOklch[];
  highSat: PixelOklch[];
}

function classifyPixels(all: PixelOklch[], bounds: AdaptiveBounds): ClassifiedPixels {
  const chroma: PixelOklch[] = [];
  const achroma: PixelOklch[] = [];
  const highSat: PixelOklch[] = [];

  for (const px of all) {
    const L = px.oklch[0];
    const C = px.oklch[1];

    if (bounds.enableHighSat && C > bounds.highSatC) {
      highSat.push(px);
    }

    if (C < bounds.achromaC || L < L_LO || L > L_HI) {
      achroma.push(px);
    } else {
      chroma.push(px);
    }
  }

  return { all, chroma, achroma, highSat };
}

// ==========================================
// Histogram utilities
// ==========================================

function oklchHueBin(h: number): number {
  const bin = Math.round(h) % HUE_BINS;
  return bin < 0 ? bin + HUE_BINS : bin;
}

function oklchLBin(L: number): number {
  return Math.min(L_BINS - 1, Math.max(0, Math.round(L * (L_BINS - 1))));
}

function oklchCBin(C: number): number {
  return Math.min(C_BINS - 1, Math.max(0, Math.round(C * C_SCALE)));
}

function inPeakRange(start: number, end: number, value: number): boolean {
  if (start <= end) return start <= value && end > value;
  return value >= start || value < end;
}

// ==========================================
// Pick best pixel near peak
// ==========================================

function pickBestNearPeak(
  candidates: PixelOklch[], targetL: number, targetC: number,
  radiusL: number, radiusC: number,
): PixelOklch | null {
  let best: PixelOklch | null = null;
  let bestScore = -Infinity;

  for (const px of candidates) {
    const dL = Math.abs(px.oklch[0] - targetL);
    const dC = Math.abs(px.oklch[1] - targetC);
    if (dL > radiusL || dC > radiusC) continue;

    const distFromPeak = Math.sqrt(dL * dL + dC * dC);
    // Prefer vivid actual colors near peak (memory color effect)
    const score = px.oklch[1] * 0.7 - distFromPeak * 0.3;

    if (score > bestScore) {
      bestScore = score;
      best = px;
    }
  }
  return best;
}

// ==========================================
// Hue sector (Munsell 10 families)
// ==========================================

function getHueSector(oklch: OKLCH): number {
  const h = oklch[2] < 0 ? oklch[2] + 360 : oklch[2];
  return Math.floor(h / SECTOR_SIZE);
}

// ==========================================
// Collinear interpolation test (JPEG artifact detection)
// ==========================================

/**
 * Squared distance from point P to the line segment A–B in OkLab space.
 * JPEG DCT artifacts are interpolations between adjacent block colors,
 * so they lie on (or very near) such segments.
 */
function pointToSegmentDistSq(p: OkLAB, a: OkLAB, b: OkLAB): number {
  const abL = b[0] - a[0], abA = b[1] - a[1], abB = b[2] - a[2];
  const apL = p[0] - a[0], apA = p[1] - a[1], apB = p[2] - a[2];
  const ab2 = abL * abL + abA * abA + abB * abB;
  if (ab2 < 1e-12) {
    // a ≈ b: degenerate segment, distance = |P-A|
    return apL * apL + apA * apA + apB * apB;
  }
  // Project P onto line A–B, clamp to segment [0,1]
  const t = Math.max(0, Math.min(1, (apL * abL + apA * abA + apB * abB) / ab2));
  const dL = a[0] + t * abL - p[0];
  const dA = a[1] + t * abA - p[1];
  const dB = a[2] + t * abB - p[2];
  return dL * dL + dA * dA + dB * dB;
}

// ==========================================
// Post-shift dedup
// ==========================================

/**
 * Peak shift can push previously-distinct colors together.
 * Merge any pair within 3×JND (MacAdam ellipse).
 */
function postShiftDedup(colors: RawColor[]): RawColor[] {
  const DEDUP_DIST = 3 * JND;
  const result: RawColor[] = [];
  const labs: OkLAB[] = [];
  const sorted = [...colors].sort((a, b) => b.imageRate - a.imageRate);

  for (const c of sorted) {
    const cLab = rgbToOklab(c.rgb);
    let merged = false;

    for (let i = 0; i < result.length; i++) {
      if (colorDifferenceOklab(cLab, labs[i]) < DEDUP_DIST) {
        result[i].imageRate += c.imageRate;
        const existingC = Math.sqrt(labs[i][1] ** 2 + labs[i][2] ** 2);
        const newC = Math.sqrt(cLab[1] ** 2 + cLab[2] ** 2);
        if (newC > existingC) {
          result[i].rgb = c.rgb;
          labs[i] = cLab;
        }
        merged = true;
        break;
      }
    }
    if (!merged) {
      result.push({ ...c });
      labs.push(cLab);
    }
  }

  const totalRate = result.reduce((s, c) => s + c.imageRate, 0);
  for (const c of result) c.rate = totalRate > 0 ? c.imageRate / totalRate : 0;
  return result;
}

// ==========================================
// Peak shift (Bartleson memory color)
// ==========================================

function applyPeakShift(colors: RawColor[]): void {
  for (const c of colors) {
    const oklch = rgbToOklch(c.rgb);
    oklch[1] = Math.min(0.4, oklch[1] * CHROMA_BOOST);
    c.rgb = oklchToRgb(oklch);
  }
}

// ========================================
// Strategy 38: MMR Points
// ========================================

export const strategy: Strategy = (
  pixels: Uint8Array,
): RawPalette => {
  const total = pixels.length >> 2;
  const all = samplePixels(pixels, total);
  if (all.length === 0) return { dominants: [], chromas: [], achromas: [], points: [] };

  // --- Global statistics ---
  const oklabData = all.map(p => p.oklab);
  const entropy = computeEntropy(oklabData);
  const S = computeSensitivity(entropy); // Stevens' power law

  let sumL = 0;
  for (const px of all) sumL += px.oklch[0];
  const meanL = sumL / all.length;

  const totalPx = all.length;
  const allChromas = all.map(p => p.oklch[1]);
  const bounds = computeAdaptiveBounds(allChromas, S, meanL); // Hunt effect
  const classified = classifyPixels(all, bounds);

  // --- Derived parameters (all from S and JND) ---
  // Identity merge: threshold in JND units (identityDistance returns JND-normalized max)
  const mergeIdentityThreshold = S * 1.2;  // S × scale factor (in JND units)
  const mergeDist = S * JND * 1.2;  // kept for dedup/other uses
  const minRate = 0.002 / S;        // β-derived minimum rate

  // Flatten threshold: JND × (1 + 1.5H) — removes sub-JND noise peaks
  const flattenThreshold = JND * (1 + 1.5 * entropy);

  // Silverman-derived smoothing (data-driven kernel width)
  const hueSmoothRepeat = computeHueSmoothRepeat(classified.chroma);
  const lSmoothRepeat = computeLSmoothRepeat(classified.achroma);

  // JND-based search radii scaled by sensitivity
  const radiusL = JND * (4 + S * 0.6);   // H=0: 0.122, H=1: 0.08
  const radiusC = JND * (2 + S * 0.3);   // H=0: 0.061, H=1: 0.04

  // Entropy-adaptive max dominants (Miller's law + Stevens' α)
  // Uses ALPHA (0.6) for consistency with sensitivity curve
  // H=0.2 → 5, H=0.5 → 8, H=0.8 → 9
  // Stevens-consistent: ALPHA (0.6) makes low-entropy images more conservative
  const adaptiveMax = Math.round(
    MIN_DOMINANTS + (MAX_DOMINANTS - MIN_DOMINANTS) * Math.pow(entropy, ALPHA),
  );

  // === Stage 1: Chroma channel — hue histogram ===
  const histoHue = new CircularHistogram1D(HUE_BINS);
  for (const px of classified.chroma) {
    histoHue.inc(oklchHueBin(px.oklch[2]));
  }

  const huePeaks = histoHue
    .gaussianSmoothing(5, hueSmoothRepeat)
    .flatten(flattenThreshold)
    .findPeaks();

  // === Stage 2: 2D L×C sub-peaks + chroma split rescue ===
  // Primary: same 2D L×C as S33 (proven reliable).
  // Rescue: after 2D, check if any hue peak has a secondary chroma level
  // that was drowned in 2D. Run 1D C histogram to find it.
  const chromaCandidates: ColorCandidate[] = [];

  // Track which hue peaks and their 2D results for rescue pass
  const huePeakData: { peak: typeof huePeaks[0]; pixels: PixelOklch[]; candidates: ColorCandidate[] }[] = [];

  for (const huePk of huePeaks) {
    const peakPixels: PixelOklch[] = [];
    for (const px of classified.chroma) {
      const hBin = oklchHueBin(px.oklch[2]);
      if (inPeakRange(huePk.start, huePk.end, hBin)) {
        peakPixels.push(px);
      }
    }
    if (peakPixels.length === 0) continue;

    const histo2D = new Histogram2D(L_BINS, C_BINS);
    for (const px of peakPixels) {
      histo2D.inc(oklchLBin(px.oklch[0]), oklchCBin(px.oklch[1]));
    }

    const subPeaks = histo2D.flatten(4 * JND).medianSmoothing(5).findPeaks();
    const hpCandidates: ColorCandidate[] = [];

    for (const sp of subPeaks) {
      const targetL = sp.x / (L_BINS - 1);
      const targetC = sp.y / C_SCALE;
      const picked = pickBestNearPeak(peakPixels, targetL, targetC, radiusL, radiusC);

      if (picked) {
        const cand: ColorCandidate = {
          rgb: picked.rgb, oklab: picked.oklab, oklch: picked.oklch,
          size: sp.size, imageRate: sp.size / totalPx,
        };
        chromaCandidates.push(cand);
        hpCandidates.push(cand);
      }
    }

    huePeakData.push({ peak: huePk, pixels: peakPixels, candidates: hpCandidates });
  }

  // --- Chroma split rescue ---
  // For each hue peak, check if there's a secondary chroma level
  // with identity distance > threshold from all existing candidates.
  // This catches colors like #748c5c (C=0.075) drowned by #7a8270 (C=0.028).
  for (const { pixels: peakPixels, candidates: existingCands } of huePeakData) {
    if (peakPixels.length < 10) continue;

    // 1D chroma histogram
    const histoC = new Histogram1D(C_BINS);
    for (const px of peakPixels) histoC.inc(oklchCBin(px.oklch[1]));

    const chromaPeaks = histoC.gaussianSmoothing(3, 2).flatten(2 * JND).findPeaks();
    if (chromaPeaks.length <= 1) continue; // no secondary level

    for (const cPk of chromaPeaks) {
      const peakC = cPk.x / C_SCALE;

      // Is this chroma level already represented by an existing candidate?
      let represented = false;
      for (const ec of existingCands) {
        const dC = Math.abs(ec.oklch[1] - peakC);
        if (dC < JND * 0.75 * mergeIdentityThreshold) { // identity distance on C axis
          represented = true;
          break;
        }
      }
      if (represented) continue;

      // Unrepresented chroma level — find its pixels and pick best
      const bandPixels = peakPixels.filter(px => {
        const cBin = oklchCBin(px.oklch[1]);
        return cBin >= cPk.start && cBin < cPk.end;
      });
      if (bandPixels.length < 3) continue;

      // Find the L peak within this chroma band
      const histoL = new Histogram1D(L_BINS);
      for (const px of bandPixels) histoL.inc(oklchLBin(px.oklch[0]));
      const lPeaks = histoL.gaussianSmoothing(3, 1).flatten(JND).findPeaks();

      for (const lPk of lPeaks) {
        const targetL = lPk.x / (L_BINS - 1);
        const picked = pickBestNearPeak(bandPixels, targetL, peakC, radiusL, radiusC);
        if (!picked) continue;

        // Count actual pixels
        let count = 0;
        for (const px of bandPixels) {
          const lBin = oklchLBin(px.oklch[0]);
          if (lBin >= lPk.start && lBin < lPk.end) count++;
        }
        if (count < 3) continue;

        chromaCandidates.push({
          rgb: picked.rgb, oklab: picked.oklab, oklch: picked.oklch,
          size: count, imageRate: count / totalPx,
        });
      }
    }
  }

  // === Stage 3: Achroma channel ===
  const histoL = new Histogram1D(L_BINS);
  for (const px of classified.achroma) {
    histoL.inc(oklchLBin(px.oklch[0]));
  }

  // Achroma flatten: 2.5 × JND (achromatic needs stronger noise suppression)
  const achromaFlatten = JND * 2.5;
  const achromaPeaks = histoL
    .gaussianSmoothing(5, lSmoothRepeat)
    .flatten(achromaFlatten)
    .findPeaks();

  const achromaCandidates: ColorCandidate[] = [];

  for (const lPk of achromaPeaks) {
    const peakPixels = classified.achroma.filter(px => {
      const lBin = oklchLBin(px.oklch[0]);
      return lBin >= lPk.start && lBin < lPk.end;
    });
    if (peakPixels.length === 0) continue;

    const targetL = lPk.x / (L_BINS - 1);
    let best: PixelOklch | null = null;
    let bestDist = Infinity;
    for (const px of peakPixels) {
      const d = Math.abs(px.oklch[0] - targetL);
      if (d < bestDist) { bestDist = d; best = px; }
    }
    if (best) {
      achromaCandidates.push({
        rgb: best.rgb,
        oklab: best.oklab,
        oklch: best.oklch,
        size: lPk.size,
        imageRate: lPk.size / totalPx,
      });
    }
  }

  // === Stage 4: Merge (identity distance) ===
  // Uses OKLCH component-wise max instead of OkLab ΔE.
  // Two colors merge only if L, C, AND H are all close — preserving color identity.
  const allCandidates = [...chromaCandidates, ...achromaCandidates]
    .filter(c => c.imageRate > minRate)
    .sort((a, b) => b.size - a.size);

  const merged: ColorCandidate[] = [];
  for (const c of allCandidates) {
    let wasMerged = false;
    for (const m of merged) {
      if (identityDistance(c.oklch, m.oklch) < mergeIdentityThreshold) {
        if (c.oklch[1] > m.oklch[1]) {
          m.rgb = c.rgb;
          m.oklab = c.oklab;
          m.oklch = c.oklch;
        }
        m.size += c.size;
        m.imageRate += c.imageRate;
        wasMerged = true;
        break;
      }
    }
    if (!wasMerged) merged.push({ ...c });
  }

  // === Stage 5: Dominant selection ===
  const dominants: RawColor[] = [];
  const chromas: RawColor[] = [];
  const achromas: RawColor[] = [];
  const domOklabs: OkLAB[] = [];
  const domOklchArr: OKLCH[] = [];

  const sectorCounts = new Map<number, number>();
  const usedIndices = new Set<number>();
  let covered = 0;

  const sortedMerged = merged.map((c, i) => ({ ...c, origIdx: i }))
    .sort((a, b) => b.size - a.size);

  for (const c of sortedMerged) {
    if (covered >= 0.85 && dominants.length >= MIN_DOMINANTS) break;
    if (dominants.length >= adaptiveMax) break;

    const sector = getHueSector(c.oklch);
    const sectorCount = sectorCounts.get(sector) || 0;
    if (sectorCount >= MAX_PER_SECTOR && dominants.length >= MIN_DOMINANTS) {
      // Sector saturated — always count toward coverage (conservative).
      // Identity-distinct colors get a second chance in Pass 2b.
      covered += c.imageRate;
      continue;
    }

    const ec: RawColor = { rgb: c.rgb, imageRate: c.imageRate, rate: 0 };
    dominants.push(ec);
    domOklabs.push(c.oklab);
    domOklchArr.push(c.oklch);
    covered += c.imageRate;
    sectorCounts.set(sector, sectorCount + 1);
    usedIndices.add(c.origIdx);

    if (c.oklch[1] < bounds.achromaC) achromas.push(ec);
    else chromas.push(ec);
  }

  // Pass 2a: Fill unrepresented hue sectors (priority)
  let filledSector = 0;
  for (const c of sortedMerged) {
    if (filledSector >= MAX_FILL_SECTOR) break;
    if (usedIndices.has(c.origIdx)) continue;
    if (c.oklch[1] < bounds.achromaC) continue;
    if (c.imageRate < minRate) continue;

    const sector = getHueSector(c.oklch);
    if (sectorCounts.has(sector)) continue; // existing sector — skip for 2a

    const ec: RawColor = { rgb: c.rgb, imageRate: c.imageRate, rate: 0 };
    dominants.push(ec);
    domOklabs.push(c.oklab);
    domOklchArr.push(c.oklch);
    sectorCounts.set(sector, 1);
    usedIndices.add(c.origIdx);
    chromas.push(ec);
    filledSector++;
  }

  // Pass 2b: Identity-distinct rescues from existing sectors
  // Colors blocked by adaptiveMax or sector cap, but genuinely different.
  // Separate cap: doesn't compete with new-sector fills.
  // Higher imageRate bar: only rescue meaningfully large clusters.
  const identityRescueMinRate = 0.005; // 0.5% — meaningful color presence
  let filledIdentity = 0;
  for (const c of sortedMerged) {
    if (filledIdentity >= MAX_FILL_IDENTITY) break;
    if (usedIndices.has(c.origIdx)) continue;
    if (c.oklch[1] < bounds.achromaC) continue;
    if (c.imageRate < identityRescueMinRate) continue;

    const sector = getHueSector(c.oklch);
    // Must be identity-distinct from all dominants in its sector
    let distinct = true;
    for (let di = 0; di < dominants.length; di++) {
      if (getHueSector(domOklchArr[di]) === sector && identityDistance(c.oklch, domOklchArr[di]) < mergeIdentityThreshold) {
        distinct = false;
        break;
      }
    }
    if (!distinct) continue;

    const ec: RawColor = { rgb: c.rgb, imageRate: c.imageRate, rate: 0 };
    dominants.push(ec);
    domOklabs.push(c.oklab);
    domOklchArr.push(c.oklch);
    sectorCounts.set(sector, (sectorCounts.get(sector) || 0) + 1);
    usedIndices.add(c.origIdx);
    chromas.push(ec);
    filledIdentity++;
  }

  const totalDom = dominants.reduce((s, d) => s + d.imageRate, 0);
  for (const d of dominants) d.rate = totalDom > 0 ? d.imageRate / totalDom : 0;

  // Peak shift (Bartleson memory color)
  applyPeakShift(dominants);

  // Post-shift dedup (peak shift can push close colors together)
  const finalDominants = postShiftDedup(dominants);

  // Cache OKLCH/OkLAB for final dominants (used in rebuild + Stage 6)
  const domOklchs: OKLCH[] = finalDominants.map(d => rgbToOklch(d.rgb));
  const finalDomOklabs: OkLAB[] = finalDominants.map(d => rgbToOklab(d.rgb));

  // Rebuild chromas/achromas from final dominants
  const finalChromas: RawColor[] = [];
  const finalAchromas: RawColor[] = [];
  for (let i = 0; i < finalDominants.length; i++) {
    if (domOklchs[i][1] < bounds.achromaC) finalAchromas.push(finalDominants[i]);
    else finalChromas.push(finalDominants[i]);
  }

  // === Stage 6: Point colors (MMR-based unified selection) ===
  //
  // Maximal Marginal Relevance [Carbonell & Goldstein 1998]:
  //   MMR(c) = λ × Rel(c) − (1−λ) × max_{s∈Selected} Sim(c, s)
  //
  // Three sources collect candidates into one pool, then MMR greedy
  // selects the best points — no execution-order priority, no explicit dedup.

  const domSectors = new Set<number>();
  for (const dlch of domOklchs) domSectors.add(getHueSector(dlch));

  // Stevens-adaptive max points: H=0 → 4, H=0.5 → 3, H=1 → 1
  const maxPoints = Math.max(2, Math.round(4 * Math.pow(1 - entropy, ALPHA)));
  // Minimum chroma for points — hue-distance adaptive.
  // Near dominant hue: require high chroma (muted version of existing hue = 칙칙).
  // Far from dominant hue: allow lower chroma (muted but genuinely different = valid accent).
  const MIN_CHROMA_NEAR = 5 * JND;  // 0.10 — same hue family
  const MIN_CHROMA_FAR = 2.5 * JND; // 0.05 — different hue family
  const HUE_FAR_THRESHOLD = 60;     // degrees: "different hue family"

  // Pre-compute min point chroma for each hue degree (LUT).
  // Result only depends on hue (0~359), so 360 entries cover all cases.
  // Avoids 15,000+ calls × dominants loop → single O(1) lookup per pixel.
  const minChromaByHue = new Float64Array(360);
  {
    const chromaDoms = domOklchs.filter(d => d[1] >= bounds.achromaC);
    for (let h = 0; h < 360; h++) {
      let minHueDist = 180;
      for (const dlch of chromaDoms) {
        let d = Math.abs(h - dlch[2]);
        if (d > 180) d = 360 - d;
        if (d < minHueDist) minHueDist = d;
      }
      const t = Math.min(1, minHueDist / HUE_FAR_THRESHOLD);
      minChromaByHue[h] = MIN_CHROMA_NEAR * (1 - t) + MIN_CHROMA_FAR * t;
    }
  }
  function minPointChromaFor(hue: number): number {
    return minChromaByHue[Math.round(hue) % 360];
  }

  // --- Candidate collection ---
  // Unified candidate type for all sources
  interface PointCandidate {
    px: PixelOklch;
    neighbors: number;    // pixel count in 2×JND radius (density measure)
    novelty: number;      // identity distance to nearest dominant
    riccoRescue: boolean; // true if admitted via Ricco's law (low density, high contrast)
  }
  const candidateMap = new Map<string, PointCandidate>(); // key = rgb hex for dedup
  const densityRadius = 2 * JND;
  const densityRadius2 = densityRadius * densityRadius;
  const minDensity = Math.max(3, Math.round(totalPx * 0.001));
  // Hard gate: minimum identity distance to any dominant (3.5 JND).
  // The ΔE-based ptDomDedupDist in validation catches any residual overlap.
  const NOVELTY_FLOOR = 3.5;

  function rgbKey(rgb: RGB): string {
    return (rgb[0] << 16 | rgb[1] << 8 | rgb[2]).toString(36);
  }

  function minNovelty(px: PixelOklch): number {
    let min = Infinity;
    for (const dlch of domOklchs) {
      const d = identityDistance(px.oklch, dlch);
      if (d < min) min = d;
    }
    return min;
  }

  // Source A: HighSat hue peak representatives
  if (classified.highSat.length > 0) {
    const histoHighSat = new CircularHistogram1D(HUE_BINS);
    for (const px of classified.highSat) {
      histoHighSat.inc(oklchHueBin(px.oklch[2]));
    }
    const highSatPeaks = histoHighSat.gaussianSmoothing(3, 3).flatten(JND).findPeaks();

    for (const hPk of highSatPeaks) {
      const peakPixels = classified.highSat.filter(px =>
        inPeakRange(hPk.start, hPk.end, oklchHueBin(px.oklch[2]))
      );
      if (peakPixels.length === 0) continue;

      let best: PixelOklch | null = null;
      let bestC = -1;
      for (const px of peakPixels) {
        if (px.oklch[1] > bestC) { bestC = px.oklch[1]; best = px; }
      }
      if (!best) continue;

      const nov = minNovelty(best);
      if (nov < NOVELTY_FLOOR) continue; // hard gate: point must differ from all dominants

      const key = rgbKey(best.rgb);
      if (!candidateMap.has(key)) {
        candidateMap.set(key, { px: best, neighbors: hPk.size, novelty: nov, riccoRescue: false });
      }
    }
  }

  // Source B: Identity-distant residual pixels (with density gate + Ricco)
  // Pre-check: does the dominant palette already cover extreme-L zones?
  const hasDarkDom = domOklchs.some(d => d[0] < 0.20);
  const hasLightDom = domOklchs.some(d => d[0] > 0.85);

  if (domOklchs.length > 0) {
    const residuals: { px: PixelOklch; contrast: number }[] = [];

    for (const px of all) {
      const isMidtone = px.oklch[0] >= 0.15 && px.oklch[0] <= 0.90;
      // Extreme-L exemption only if dominants don't already cover that zone.
      // If there's already a dark dominant, more blacks are redundant.
      const extremeExempt = !isMidtone
        && !(px.oklch[0] < 0.15 && hasDarkDom)
        && !(px.oklch[0] > 0.90 && hasLightDom);
      if (px.oklch[1] < minPointChromaFor(px.oklch[2]) && !extremeExempt) continue;

      let minIdent = Infinity;
      for (const dlch of domOklchs) {
        const d = identityDistance(px.oklch, dlch);
        if (d < minIdent) { minIdent = d; if (minIdent < NOVELTY_FLOOR) break; }
      }
      if (minIdent >= NOVELTY_FLOOR) {
        residuals.push({ px, contrast: minIdent });
      }
    }

    // Density measurement for top residuals
    // L-axis sorted window scan: only compare pairs where |dL| <= densityRadius
    const densityCandidates = residuals.length > 500
      ? [...residuals].sort((a, b) => b.contrast - a.contrast).slice(0, 500)
      : residuals;

    // Sort residuals by OkLAB L for windowed search
    const sortedResiduals = [...residuals].sort((a, b) => a.px.oklab[0] - b.px.oklab[0]);
    const residualLs = sortedResiduals.map(r => r.px.oklab[0]);

    for (const c of densityCandidates) {
      const cL = c.px.oklab[0];
      // Binary search for L-window bounds
      let lo = 0, hi = residualLs.length;
      const loTarget = cL - densityRadius;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (residualLs[mid] < loTarget) lo = mid + 1; else hi = mid; }
      let end = lo, endHi = residualLs.length;
      const hiTarget = cL + densityRadius;
      while (end < endHi) { const mid = (end + endHi) >> 1; if (residualLs[mid] <= hiTarget) end = mid + 1; else endHi = mid; }

      let neighbors = 0;
      for (let i = lo; i < end; i++) {
        const other = sortedResiduals[i];
        const dL = cL - other.px.oklab[0];
        const dA = c.px.oklab[1] - other.px.oklab[1];
        const dB = c.px.oklab[2] - other.px.oklab[2];
        if (dL * dL + dA * dA + dB * dB < densityRadius2) neighbors++;
        if (neighbors >= minDensity) break;
      }

      let riccoRescue = false;
      if (neighbors < minDensity) {
        // Ricco rescue: high contrast compensates low density
        const contrastRatio = Math.max(1, c.contrast / RICCO_REF);
        const riccoMinCount = Math.max(2, Math.round(minDensity / contrastRatio));
        if (neighbors >= riccoMinCount) {
          riccoRescue = true;
        } else {
          continue; // truly noise
        }
      }

      const key = rgbKey(c.px.rgb);
      if (!candidateMap.has(key)) {
        candidateMap.set(key, { px: c.px, neighbors, novelty: c.contrast, riccoRescue });
      }
    }
  }

  // Source C: Sector vivid anchors (most saturated variant per 12° sub-bin)
  {
    const SUB_BIN_SIZE = 12;
    const subBinBest = new Map<number, PixelOklch>();
    for (const px of classified.chroma) {
      let h = px.oklch[2];
      if (h < 0) h += 360;
      const subBin = Math.floor(h / SUB_BIN_SIZE);
      const cur = subBinBest.get(subBin);
      if (!cur || px.oklch[1] > cur.oklch[1]) {
        subBinBest.set(subBin, px);
      }
    }

    for (let di = 0; di < finalDominants.length; di++) {
      const dLch = domOklchs[di];
      const sector = getHueSector(dLch);
      const sectorStart = sector * SECTOR_SIZE;
      const sectorEnd = sectorStart + SECTOR_SIZE;
      const subStart = Math.floor(sectorStart / SUB_BIN_SIZE);
      const subEnd = Math.floor((sectorEnd - 1) / SUB_BIN_SIZE);

      for (let sb = subStart; sb <= subEnd; sb++) {
        const bestPx = subBinBest.get(sb);
        if (!bestPx || bestPx.oklch[1] <= dLch[1]) continue;
        const isMid = bestPx.oklch[0] >= 0.15 && bestPx.oklch[0] <= 0.90;
        if (bestPx.oklch[1] < minPointChromaFor(bestPx.oklch[2]) && isMid) continue;

        const nov = minNovelty(bestPx);
        if (nov < NOVELTY_FLOOR) continue;

        const key = rgbKey(bestPx.rgb);
        if (!candidateMap.has(key)) {
          // Measure density for cluster verification
          let neighbors = 0;
          const searchR2 = (3 * JND) * (3 * JND);
          for (const px of classified.chroma) {
            const dL2 = px.oklab[0] - bestPx.oklab[0];
            const dA2 = px.oklab[1] - bestPx.oklab[1];
            const dB2 = px.oklab[2] - bestPx.oklab[2];
            if (dL2 * dL2 + dA2 * dA2 + dB2 * dB2 < searchR2) neighbors++;
            if (neighbors >= 3) break;
          }
          if (neighbors >= 3) {
            candidateMap.set(key, { px: bestPx, neighbors, novelty: nov, riccoRescue: false });
          }
        }
      }
    }
  }

  // --- MMR Greedy Selection ---
  const candidates = [...candidateMap.values()];
  const MMR_LAMBDA = 0.5; // balanced relevance and diversity

  // Raw relevance: novelty × vividness × mass × sectorBonus
  // sectorBonus 3.0: strongly prefer points in new hue families over same-hue variants.
  function rawRelevance(c: PointCandidate): number {
    const vividness = 1 + c.px.oklch[1] * 5;
    const mass = Math.log2(1 + c.neighbors);
    const sectorBonus = domSectors.has(getHueSector(c.px.oklch)) ? 1.0 : 3.0;
    return c.novelty * vividness * mass * sectorBonus;
  }

  // Pre-compute relevance scores and normalize to [0,1]
  const rawScores = candidates.map(rawRelevance);
  let maxRaw = 0;
  for (const r of rawScores) { if (r > maxRaw) maxRaw = r; }
  const normFactor = maxRaw > 0 ? maxRaw : 1;

  // Similarity: linear decay with hard cutoff at SIM_HORIZON JND.
  // At identityDistance = NOVELTY_FLOOR (3.5): sim ≈ 0.5 → meaningful diversity penalty.
  // At identityDistance = SIM_HORIZON (7.0): sim = 0 → no penalty for truly different colors.
  const SIM_HORIZON = 7.0;
  function similarity(a: PixelOklch, b: OKLCH): number {
    const d = identityDistance(a.oklch, b);
    return Math.max(0, 1 - d / SIM_HORIZON);
  }

  // Hard floor: selected points must be at least this identity distance apart (JND units)
  const POINT_MIN_IDENTITY = Math.max(NOVELTY_FLOOR, S * 1.2);

  const selected: { px: PixelOklch; neighbors: number; riccoRescue: boolean }[] = [];
  const selectedOklchs: OKLCH[] = [];

  // --- Phase 1: Diversity slot ---
  // Reserve first slot for the best candidate from a non-dominant sector.
  // This guarantees hue exploration before same-sector filling.
  // S37's 4-channel structure achieved this implicitly; MMR needs explicit help.
  {
    let bestNewIdx = -1;
    let bestNewScore = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (domSectors.has(getHueSector(c.px.oklch))) continue; // skip dominant sectors
      const score = rawScores[i];
      if (score > bestNewScore) { bestNewScore = score; bestNewIdx = i; }
    }
    if (bestNewIdx >= 0) {
      const picked = candidates.splice(bestNewIdx, 1)[0];
      rawScores.splice(bestNewIdx, 1);
      selected.push(picked);
      selectedOklchs.push(picked.px.oklch);
    }
  }

  // --- Phase 2: Standard MMR for remaining slots ---
  for (let round = selected.length; round < maxPoints && candidates.length > 0; round++) {
    let bestIdx = -1;
    let bestMmr = -Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const normRel = rawScores[i] / normFactor;

      // Hard gate: skip if too close to any already-selected point
      let tooClose = false;
      for (const sOklch of selectedOklchs) {
        if (identityDistance(c.px.oklch, sOklch) < POINT_MIN_IDENTITY) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Max similarity to already-selected points AND dominants
      let maxSim = 0;
      for (const s of selected) {
        const sim = similarity(c.px, s.px.oklch);
        if (sim > maxSim) maxSim = sim;
      }
      for (const dlch of domOklchs) {
        const sim = similarity(c.px, dlch);
        if (sim > maxSim) maxSim = sim;
      }

      const mmr = MMR_LAMBDA * normRel - (1 - MMR_LAMBDA) * maxSim;
      if (mmr > bestMmr) { bestMmr = mmr; bestIdx = i; }
    }

    if (bestIdx < 0) break;
    const picked = candidates.splice(bestIdx, 1)[0];
    rawScores.splice(bestIdx, 1); // keep rawScores aligned
    selected.push(picked);
    selectedOklchs.push(picked.px.oklch);
  }

  // --- Validation: density + collinear + Pt-Dom ΔE gate ---
  const densityCheckR2 = (3 * JND) ** 2;
  const minPointDensity = 0.001;
  const collinearThresholdSq = (2 * JND) * (2 * JND);
  const ANCHOR_DENSITY = 0.05;
  const ptDomDedupDist = Math.max(S * JND * 1.2, 3.5 * JND); // matches S37

  interface MeasuredPoint { pt: RawColor; lab: OkLAB; density: number; riccoRescue: boolean; }
  const measured: MeasuredPoint[] = [];

  for (const s of selected) {
    const ptLab = s.px.oklab;

    // Hard Pt-Dom ΔE dedup: point must not overlap any dominant in OkLab space
    let domTooClose = false;
    for (const dLab of finalDomOklabs) {
      if (colorDifferenceOklab(ptLab, dLab) < ptDomDedupDist) {
        domTooClose = true;
        break;
      }
    }
    if (domTooClose) continue;

    const pt: RawColor = { rgb: s.px.rgb, imageRate: s.neighbors / totalPx, rate: 0 };
    let nearby = 0;
    for (const px of all) {
      const dL = px.oklab[0] - ptLab[0];
      const dA = px.oklab[1] - ptLab[1];
      const dB = px.oklab[2] - ptLab[2];
      if (dL * dL + dA * dA + dB * dB < densityCheckR2) nearby++;
    }
    const density = nearby / all.length;

    // Ricco-rescued points bypass density gate (pre-validated by mass × contrast)
    if (density >= minPointDensity || s.riccoRescue) {
      measured.push({ pt, lab: ptLab, density, riccoRescue: s.riccoRescue });
    }
  }

  measured.sort((a, b) => b.density - a.density);

  const anchorLabs: OkLAB[] = [...finalDomOklabs];
  const allPoints: RawColor[] = [];

  for (const m of measured) {
    if (m.density >= ANCHOR_DENSITY) {
      anchorLabs.push(m.lab);
      allPoints.push(m.pt);
    } else {
      // Collinear test (Ricco and normal share same logic)
      let isCollinear = false;
      for (let i = 0; i < anchorLabs.length && !isCollinear; i++) {
        for (let j = i + 1; j < anchorLabs.length && !isCollinear; j++) {
          if (pointToSegmentDistSq(m.lab, anchorLabs[i], anchorLabs[j]) < collinearThresholdSq) {
            isCollinear = true;
          }
        }
      }
      if (!isCollinear) allPoints.push(m.pt);
    }
  }

  return { dominants: finalDominants, chromas: finalChromas, achromas: finalAchromas, points: allPoints };
};

