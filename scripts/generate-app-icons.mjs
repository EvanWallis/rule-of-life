/**
 * Minimal PNG generator for app icons (no external deps).
 *
 * Produces:
 * - src/app/icon.png (512x512)
 * - src/app/apple-icon.png (180x180)
 * - src/app/apple-touch-icon.png (180x180)
 */

import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = process.cwd();
const OUT_ICON = path.join(ROOT, "src", "app", "icon.png");
const OUT_APPLE = path.join(ROOT, "src", "app", "apple-icon.png");
const OUT_APPLE_TOUCH = path.join(ROOT, "src", "app", "apple-touch-icon.png");

function clamp01(n) {
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

function hexToRgba(hex, a = 255) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Bad color: ${hex}`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, a];
}

function blend(dst, src) {
  const sa = src[3] / 255;
  const da = dst[3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return [0, 0, 0, 0];
  const outR = (src[0] * sa + dst[0] * da * (1 - sa)) / outA;
  const outG = (src[1] * sa + dst[1] * da * (1 - sa)) / outA;
  const outB = (src[2] * sa + dst[2] * da * (1 - sa)) / outA;
  return [Math.round(outR), Math.round(outG), Math.round(outB), Math.round(outA * 255)];
}

function crc32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = crc32Table();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePngRgba(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter=0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  const chunks = [
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ];

  return Buffer.concat([signature, ...chunks]);
}

function drawIcon(size) {
  const bg = hexToRgba("#f8f5f0");
  const surface = hexToRgba("#fff7ea");
  const border = hexToRgba("#e84a27");
  const ink = hexToRgba("#1b1a17");

  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    buf[i * 4 + 0] = bg[0];
    buf[i * 4 + 1] = bg[1];
    buf[i * 4 + 2] = bg[2];
    buf[i * 4 + 3] = 255;
  }

  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const R = Math.floor(size * 0.38); // circle radius
  const borderW = Math.max(6, Math.floor(size * 0.035));
  const aa = 1.25;

  function setPixel(x, y, rgba) {
    const idx = (y * size + x) * 4;
    const dst = [buf[idx], buf[idx + 1], buf[idx + 2], buf[idx + 3]];
    const out = blend(dst, rgba);
    buf[idx] = out[0];
    buf[idx + 1] = out[1];
    buf[idx + 2] = out[2];
    buf[idx + 3] = out[3];
  }

  // Circle with border + subtle AA
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const inside = R - d;
      if (inside <= -aa) continue;

      const coverage = clamp01((inside + aa) / (2 * aa));
      const isBorder = d >= R - borderW;
      const color = isBorder ? border : surface;
      setPixel(x, y, [color[0], color[1], color[2], Math.round(255 * coverage)]);
    }
  }

  // Cross (simple thick strokes)
  const crossW = Math.max(10, Math.floor(size * 0.07));
  const crossH = Math.floor(size * 0.42);
  const barH = Math.max(10, Math.floor(size * 0.07));
  const barW = Math.floor(size * 0.34);

  const x0 = Math.floor(cx - crossW / 2);
  const x1 = x0 + crossW;
  const y0 = Math.floor(cy - crossH / 2);
  const y1 = y0 + crossH;

  const bx0 = Math.floor(cx - barW / 2);
  const bx1 = bx0 + barW;
  const by0 = Math.floor(cy - barH / 2);
  const by1 = by0 + barH;

  function inRect(x, y, rx0, ry0, rx1, ry1) {
    return x >= rx0 && x < rx1 && y >= ry0 && y < ry1;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inVert = inRect(x, y, x0, y0, x1, y1);
      const inHorz = inRect(x, y, bx0, by0, bx1, by1);
      if (!inVert && !inHorz) continue;

      // Keep the cross inside the circle with a small margin.
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > R - borderW - 3) continue;

      setPixel(x, y, ink);
    }
  }

  return buf;
}

async function writePng(file, size) {
  const rgba = drawIcon(size);
  const png = encodePngRgba(size, size, rgba);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, png);
}

await writePng(OUT_ICON, 512);
await writePng(OUT_APPLE, 180);
await writePng(OUT_APPLE_TOUCH, 180);

console.log("Wrote:", path.relative(ROOT, OUT_ICON));
console.log("Wrote:", path.relative(ROOT, OUT_APPLE));
console.log("Wrote:", path.relative(ROOT, OUT_APPLE_TOUCH));

