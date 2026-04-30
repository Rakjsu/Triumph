// Convert RGBA byte array from Rust to Base64 Image (supports any size: 64, 128, 256px)
export function rgbaToBase64(rgbaBuffer: number[]): string {
  try {
    const pixelCount = rgbaBuffer.length / 4;
    const size = Math.round(Math.sqrt(pixelCount));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    const imgData = ctx.createImageData(size, size);
    for (let i = 0; i < rgbaBuffer.length; i++) {
      imgData.data[i] = rgbaBuffer[i];
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}
