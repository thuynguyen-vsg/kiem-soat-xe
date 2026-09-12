// Sinh icon PNG cho PWA (manifest + apple-touch-icon) bằng tay, không cần
// thư viện ngoài (chỉ dùng zlib có sẵn trong Node). Chạy: node scripts/gen-icons.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const NAVY = [11, 61, 145]; // #0b3d91 — trùng màu header của app
const WHITE = [255, 255, 255];

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function drawIcon(size) {
  const px = new Array(size * size);
  const s = size;
  // nền navy bo góc nhẹ (giống app icon chuẩn)
  const bgR = s * 0.22;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      px[y * s + x] = inRoundedRect(x, y, 0, 0, s - 1, s - 1, bgR) ? NAVY : NAVY; // full bleed navy
    }
  }
  // khung trắng bo tròn ở giữa (nền cho hình xe)
  const pad = s * 0.14;
  const r2 = s * 0.12;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      if (inRoundedRect(x, y, pad, pad, s - 1 - pad, s - 1 - pad, r2)) px[y * s + x] = WHITE;
    }
  }
  // thân xe (hình chữ nhật bo tròn, màu navy) — cách điệu đơn giản
  const bodyX0 = s * 0.28, bodyX1 = s * 0.72;
  const bodyY0 = s * 0.44, bodyY1 = s * 0.58;
  const bodyR = s * 0.05;
  // nóc xe (hình thang đơn giản = chữ nhật nhỏ hơn phía trên)
  const roofX0 = s * 0.37, roofX1 = s * 0.63;
  const roofY0 = s * 0.36, roofY1 = s * 0.44;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      if (inRoundedRect(x, y, bodyX0, bodyY0, bodyX1, bodyY1, bodyR)) px[y * s + x] = NAVY;
      if (inRoundedRect(x, y, roofX0, roofY0, roofX1, roofY1, s * 0.03)) px[y * s + x] = NAVY;
    }
  }
  // 2 bánh xe (hình tròn navy trên nền trắng)
  const wheelR = s * 0.07;
  const wheelY = bodyY1;
  const wheelXs = [s * 0.38, s * 0.62];
  for (const wx of wheelXs) {
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const dx = x - wx, dy = y - wheelY;
        if (dx * dx + dy * dy <= wheelR * wheelR) px[y * s + x] = NAVY;
      }
    }
  }
  return px;
}

function encodePNG(size, outPath) {
  const px = drawIcon(size);
  const raw = Buffer.alloc(size * (1 + size * 3));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter type: None
    for (let x = 0; x < size; x++) {
      const c = px[y * size + x];
      raw[o++] = c[0];
      raw[o++] = c[1];
      raw[o++] = c[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(outPath, png);
  console.log("wrote", outPath, size + "x" + size);
}

const outDir = path.join(__dirname, "..", "public");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
encodePNG(192, path.join(outDir, "icon-192.png"));
encodePNG(512, path.join(outDir, "icon-512.png"));
encodePNG(180, path.join(outDir, "apple-touch-icon.png"));
