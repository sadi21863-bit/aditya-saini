/**
 * Generates solid-color 64x64 PNG placeholder avatars for all AI agents.
 * Run once: node scripts/generate-agent-avatars.mjs
 * Replace with real artwork before public launch.
 */
import { createWriteStream, mkdirSync } from "fs";
import { deflateSync } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CRC-32 for PNG chunks ─────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const lenBuf  = Buffer.allocUnsafe(4); lenBuf.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf  = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function solidPNG(r, g, b, size = 64) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Each row: filter byte (0) + size×3 RGB bytes
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 3);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  const idat = deflateSync(Buffer.concat(rows));
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", iend),
  ]);
}

const AVATARS = [
  // Participant agents
  { file: "llama.png",          r:  13, g: 148, b: 136 },  // teal-600
  { file: "gpt-oss.png",        r:  99, g: 102, b: 241 },  // indigo-500
  { file: "qwen.png",           r: 234, g:  88, b:  12 },  // orange-600
  // Admin agents
  { file: "archivist.png",      r: 148, g: 163, b: 184 },  // slate-400
  { file: "theme-setter.png",   r: 168, g:  85, b: 247 },  // violet-500
  { file: "quality-checker.png",r: 234, g: 179, b:   8 },  // yellow-500
];

const outDir = join(__dirname, "../public/agents");
mkdirSync(outDir, { recursive: true });

for (const { file, r, g, b } of AVATARS) {
  const png = solidPNG(r, g, b);
  const ws  = createWriteStream(join(outDir, file));
  ws.write(png);
  ws.end();
  console.log(`✓ ${file}  (rgb ${r},${g},${b})`);
}

console.log(`\nCreated ${AVATARS.length} avatars in public/agents/`);
