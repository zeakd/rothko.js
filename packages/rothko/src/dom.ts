/**
 * rothko/dom — 브라우저 이미지 소스에서 RGBA 픽셀 데이터를 추출하는 유틸.
 * createImageBitmap 기반 비동기 처리.
 */

export interface PixelData {
  data: Uint8Array;
  width: number;
  height: number;
}

type ImageSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap | Blob;

/**
 * 이미지 소스에서 RGBA 픽셀 데이터를 추출한다.
 * createImageBitmap으로 디코딩을 off-main-thread 처리.
 */
export async function readPixels(source: ImageSource): Promise<PixelData> {
  let bitmap: ImageBitmap;

  if (source instanceof ImageBitmap) {
    bitmap = source;
  } else {
    bitmap = await createImageBitmap(source);
  }

  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);

  const { data } = ctx.getImageData(0, 0, width, height);
  return { data: new Uint8Array(data.buffer), width, height };
}
