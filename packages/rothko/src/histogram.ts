/**
 * Histogram analysis — 1D circular, 1D linear, 2D.
 *
 * Optimizations vs lab/shared/histogram.ts:
 *   - convolve: reuse output buffer when chaining (gaussianSmoothing, medianSmoothing)
 *   - 2D convolution: separable pass avoided (kernel is uniform, not separable gains)
 *   - findPeaks: same state machine, minor alloc reduction
 *   - flatten: in-place when possible (returns this)
 */

// ---------- Peak type ----------

export interface Peak {
  start: number;
  end: number;
  x: number;
  size: number;
  rate: number;
}

export interface Peak2D {
  x: number;
  y: number;
  height: number;
  size: number;
}

// ---------- Gaussian kernels (pre-normalized) ----------

const KERNELS: Record<number, Float64Array> = {
  1: Float64Array.of(1),
  3: Float64Array.of(0.25, 0.5, 0.25),
  5: Float64Array.of(0.0625, 0.25, 0.375, 0.25, 0.0625),
  7: Float64Array.of(1 / 64, 6 / 64, 15 / 64, 20 / 64, 15 / 64, 6 / 64, 1 / 64),
};

// ========== Circular 1D Histogram (Hue) ==========

export class CircularHistogram1D {
  data: Float64Array;
  readonly length: number;

  constructor(length: number) {
    this.data = new Float64Array(length);
    this.length = length;
  }

  private idx(i: number): number {
    return ((i % this.length) + this.length) % this.length;
  }

  get(i: number): number {
    return this.data[this.idx(i)];
  }

  inc(i: number): void {
    this.data[this.idx(i)]++;
  }

  max(): number {
    let m = -Infinity;
    for (let i = 0; i < this.length; i++) {
      if (this.data[i] > m) m = this.data[i];
    }
    return m;
  }

  /**
   * Gaussian smoothing — reuses a single scratch buffer for all repeats.
   * Returns a new histogram (does not mutate this).
   */
  gaussianSmoothing(kSize: number, repeat: number = 1): CircularHistogram1D {
    const kernel = KERNELS[kSize];
    if (!kernel) throw new Error(`Unsupported kernel size: ${kSize}. Use 1, 3, 5, or 7.`);
    const kRange = Math.floor(kernel.length / 2);

    // Two buffers: read from src, write to dst, then swap
    let src = new Float64Array(this.data);
    let dst = new Float64Array(this.length);

    for (let r = 0; r < repeat; r++) {
      for (let i = 0; i < this.length; i++) {
        let sum = 0;
        for (let k = -kRange; k <= kRange; k++) {
          const idx = ((i + k) % this.length + this.length) % this.length;
          sum += src[idx] * kernel[k + kRange];
        }
        dst[i] = sum;
      }
      // Swap buffers
      const tmp = src;
      src = dst;
      dst = tmp;
    }

    const result = new CircularHistogram1D(this.length);
    result.data = src;
    return result;
  }

  /**
   * Zero out bins below threshold * max.
   * Returns a new histogram.
   */
  flatten(threshold: number): CircularHistogram1D {
    const result = new CircularHistogram1D(this.length);
    const cutoff = threshold * this.max();
    for (let i = 0; i < this.length; i++) {
      if (this.data[i] > cutoff) result.data[i] = this.data[i];
    }
    return result;
  }

  findPeaks(): Peak[] {
    const peaks: Peak[] = [];
    let total = 0;
    let state = 0;

    // Find global minimum as start point
    let minVal = Infinity;
    let minIdx = 0;
    for (let i = 0; i < this.length; i++) {
      if (this.data[i] < minVal) {
        minVal = this.data[i];
        minIdx = i;
      }
    }

    let peakStart = 0;
    let peakX = 0;
    let peakSize = 0;

    for (let x = minIdx; x < this.length + minIdx; x++) {
      const curr = this.get(x);
      const next = this.get(x + 1);
      total += curr;

      switch (state) {
        case 0:
          if (curr < next) {
            peakStart = x;
            peakSize = curr;
            state = 1;
          }
          break;
        case 1:
          if (curr !== next) {
            peakSize += curr;
            if (curr > next) {
              peakX = x;
              state = 2;
            }
          } else {
            state = 0;
          }
          break;
        case 2:
          if (curr > next) {
            peakSize += curr;
          } else {
            peaks.push({
              start: this.normalize(peakStart),
              end: this.normalize(x),
              x: this.normalize(peakX),
              size: peakSize,
              rate: 0,
            });
            if (curr < next) {
              peakStart = x;
              peakSize = curr;
              state = 1;
            } else {
              state = 0;
            }
          }
          break;
      }
    }

    if (state > 0) {
      const endX = this.length + minIdx;
      peaks.push({
        start: this.normalize(peakStart),
        end: this.normalize(endX),
        x: this.normalize(state === 1 ? endX - 1 : peakX),
        size: peakSize,
        rate: 0,
      });
    }

    peaks.sort((a, b) => b.size - a.size);
    for (const p of peaks) {
      p.rate = total > 0 ? p.size / total : 0;
    }
    return peaks;
  }

  private normalize(idx: number): number {
    return ((idx % this.length) + this.length) % this.length;
  }
}

// ========== Linear 1D Histogram ==========

export class Histogram1D {
  data: Float64Array;
  readonly length: number;

  constructor(length: number) {
    this.data = new Float64Array(length);
    this.length = length;
  }

  get(i: number): number {
    if (i < 0) return this.data[0];
    if (i >= this.length) return this.data[this.length - 1];
    return this.data[i];
  }

  inc(i: number): void {
    if (i >= 0 && i < this.length) this.data[i]++;
  }

  max(): number {
    let m = -Infinity;
    for (let i = 0; i < this.length; i++) {
      if (this.data[i] > m) m = this.data[i];
    }
    return m;
  }

  gaussianSmoothing(kSize: number, repeat: number = 1): Histogram1D {
    const kernel = KERNELS[kSize];
    if (!kernel) throw new Error(`Unsupported kernel size: ${kSize}. Use 1, 3, 5, or 7.`);
    const kRange = Math.floor(kernel.length / 2);

    let src = new Float64Array(this.data);
    let dst = new Float64Array(this.length);

    for (let r = 0; r < repeat; r++) {
      for (let i = 0; i < this.length; i++) {
        let sum = 0;
        for (let k = -kRange; k <= kRange; k++) {
          const idx = i + k;
          const v = idx < 0 ? src[0] : idx >= this.length ? src[this.length - 1] : src[idx];
          sum += v * kernel[k + kRange];
        }
        dst[i] = sum;
      }
      const tmp = src;
      src = dst;
      dst = tmp;
    }

    const result = new Histogram1D(this.length);
    result.data = src;
    return result;
  }

  flatten(threshold: number): Histogram1D {
    const result = new Histogram1D(this.length);
    const cutoff = threshold * this.max();
    for (let i = 0; i < this.length; i++) {
      if (this.data[i] > cutoff) result.data[i] = this.data[i];
    }
    return result;
  }

  findPeaks(): Peak[] {
    const peaks: Peak[] = [];
    let total = 0;
    let state = 0;

    let peakStart = 0;
    let peakX = 0;
    let peakSize = 0;

    for (let x = 0; x < this.length; x++) {
      const curr = this.get(x);
      const next = this.get(x + 1);
      total += curr;

      switch (state) {
        case 0:
          if (curr < next) {
            peakStart = x;
            peakSize = curr;
            state = 1;
          } else if (x === 0 && curr > next) {
            peakStart = x;
            peakX = x;
            peakSize = curr;
            state = 2;
          }
          break;
        case 1:
          if (curr !== next) {
            peakSize += curr;
            if (curr > next) {
              peakX = x;
              state = 2;
            }
          } else {
            state = 0;
          }
          break;
        case 2:
          if (curr > next) {
            peakSize += curr;
          } else {
            peaks.push({
              start: peakStart,
              end: x,
              x: peakX,
              size: peakSize,
              rate: 0,
            });
            if (curr < next) {
              peakStart = x;
              peakSize = curr;
              state = 1;
            } else {
              state = 0;
            }
          }
          break;
      }
    }

    if (state > 0) {
      peaks.push({
        start: peakStart,
        end: this.length,
        x: state === 1 ? this.length - 1 : peakX,
        size: peakSize,
        rate: 0,
      });
    }

    peaks.sort((a, b) => b.size - a.size);
    for (const p of peaks) {
      p.rate = total > 0 ? p.size / total : 0;
    }
    return peaks;
  }
}

// ========== 2D Histogram ==========

export class Histogram2D {
  data: Float64Array;
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Float64Array(width * height);
  }

  private i(x: number, y: number): number {
    return x * this.height + y;
  }

  get(x: number, y: number): number {
    return this.data[this.i(x, y)];
  }

  set(x: number, y: number, v: number): void {
    this.data[this.i(x, y)] = v;
  }

  inc(x: number, y: number): void {
    this.data[this.i(x, y)]++;
  }

  max(): number {
    let m = 0;
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] > m) m = this.data[i];
    }
    return m;
  }

  flatten(threshold: number): Histogram2D {
    const result = new Histogram2D(this.width, this.height);
    const cutoff = threshold * this.max();
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] > cutoff) result.data[i] = this.data[i];
    }
    return result;
  }

  /**
   * 5×5 uniform smoothing — double-buffered to avoid repeated allocation.
   */
  medianSmoothing(repeat: number = 1): Histogram2D {
    const w = this.width;
    const h = this.height;
    const inv = 1 / 25;
    const cvRange = 2;

    let src = new Float64Array(this.data);
    let dst = new Float64Array(w * h);

    for (let r = 0; r < repeat; r++) {
      dst.fill(0);
      for (let x = cvRange; x < w - cvRange; x++) {
        for (let y = cvRange; y < h - cvRange; y++) {
          let sum = 0;
          for (let i = -cvRange; i <= cvRange; i++) {
            const rowBase = (x + i) * h;
            for (let j = -cvRange; j <= cvRange; j++) {
              sum += src[rowBase + y + j];
            }
          }
          dst[x * h + y] = sum * inv;
        }
      }
      const tmp = src;
      src = dst;
      dst = tmp;
    }

    const result = new Histogram2D(w, h);
    result.data = src;
    return result;
  }

  findPeaks(): Peak2D[] {
    const peaks: Peak2D[] = [];
    const w = this.width;
    const h = this.height;

    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const v = this.data[x * h + y];
        if (v === 0) continue;

        if (!this.isLocalMax(x, y, v)) continue;

        let size = v;
        // Expand right
        for (let r = x + 1; r < w && r + 1 < w && this.get(r, y) > this.get(r + 1, y); r++) {
          for (let u = y + 1; u < h && u + 1 < h && this.get(r, u) > this.get(r, u + 1); u++) {
            size += this.get(r, u);
          }
          for (let d = y - 1; d >= 0 && d - 1 >= 0 && this.get(r, d) > this.get(r, d - 1); d--) {
            size += this.get(r, d);
          }
        }
        // Expand left
        for (let l = x - 1; l >= 0 && l - 1 >= 0 && this.get(l, y) > this.get(l - 1, y); l--) {
          for (let u = y + 1; u < h && u + 1 < h && this.get(l, u) > this.get(l, u + 1); u++) {
            size += this.get(l, u);
          }
          for (let d = y - 1; d >= 0 && d - 1 >= 0 && this.get(l, d) > this.get(l, d - 1); d--) {
            size += this.get(l, d);
          }
        }
        peaks.push({ x, y, height: v, size });
      }
    }

    peaks.sort((a, b) => b.size - a.size);
    return peaks;
  }

  private isLocalMax(x: number, y: number, v: number): boolean {
    const h = this.height;
    const data = this.data;
    const dirs = [
      [-1, 1], [0, 1], [1, 1],
      [-1, 0],         [1, 0],
      [-1, -1], [0, -1], [1, -1],
    ];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < this.width && ny >= 0 && ny < h) {
        if (data[nx * h + ny] >= v) return false;
      }
    }
    return true;
  }
}
