// 使用 bun 运行: bun run scripts/generate-icons.js
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';

// 生成 SVG 字符串
function createSvg(size) {
  const fontSize = Math.round(size * 0.6);
  const radius = Math.round(size * 0.15);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#4285f4"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="bold"
        font-size="${fontSize}px" fill="white">T</text>
</svg>`;
}

// CRC32 查找表
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function createPngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBytes, data]);

  let crc = 0xffffffff;
  for (const byte of typeAndData) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeAndData, crcBuf]);
}

// 生成最小 PNG（纯蓝色方块，用于开发阶段占位）
function createMinimalPng(size) {
  const rowSize = size * 4 + 1;
  const rawData = Buffer.alloc(rowSize * size);
  for (let y = 0; y < size; y++) {
    rawData[y * rowSize] = 0;
    for (let x = 0; x < size; x++) {
      const offset = y * rowSize + 1 + x * 4;
      rawData[offset] = 0x42;
      rawData[offset + 1] = 0x85;
      rawData[offset + 2] = 0xf4;
      rawData[offset + 3] = 0xff;
    }
  }

  const compressed = deflateSync(rawData);
  const chunks = [];
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  chunks.push(createPngChunk('IHDR', ihdr));
  chunks.push(createPngChunk('IDAT', compressed));
  chunks.push(createPngChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

async function main() {
  const sizes = [16, 48, 128];
  for (const size of sizes) {
    const svg = createSvg(size);
    writeFileSync(`icons/icon-${size}.svg`, svg);
  }
  for (const size of sizes) {
    const png = createMinimalPng(size);
    writeFileSync(`icons/icon-${size}.png`, png);
  }
  console.log('已生成占位 PNG 图标（蓝色方块），可在开发阶段使用。发布前请替换为正式图标。');
}

main();
