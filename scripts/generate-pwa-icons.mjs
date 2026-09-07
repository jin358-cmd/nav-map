import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const ANY_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="114" fill="#0a0a0a"/>
  <path d="M256 86 L132 398 L256 300 Z" fill="#F6DE4A"/>
  <path d="M256 86 L380 398 L256 300 Z" fill="#C89614"/>
  <path d="M256 108 L256 286" fill="none" stroke="#FFF3A8" stroke-width="6" stroke-linecap="round" opacity="0.72"/>
</svg>`;

const MASKABLE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0a0a"/>
  <path d="M256 118 L160 378 L256 298 Z" fill="#F6DE4A"/>
  <path d="M256 118 L352 378 L256 298 Z" fill="#C89614"/>
  <path d="M256 136 L256 286" fill="none" stroke="#FFF3A8" stroke-width="5" stroke-linecap="round" opacity="0.72"/>
</svg>`;

async function writePng(svg, path, size) {
  const buffer = await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path, buffer);
  return buffer;
}

function pngToIco(png32) {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(32, 6);
  header.writeUInt8(32, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png32.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png32]);
}

const any512 = await writePng(ANY_SVG, "/workspace/public/icons/icon-512.png", 512);
await writePng(ANY_SVG, "/workspace/public/icons/icon-192.png", 192);
await writePng(MASKABLE_SVG, "/workspace/public/icons/icon-maskable-512.png", 512);
await writePng(MASKABLE_SVG, "/workspace/public/icons/icon-maskable-192.png", 192);
await writeFile("/workspace/public/icons/navpilot.png", any512);
await writePng(ANY_SVG, "/workspace/src/app/icon.png", 192);
await writePng(ANY_SVG, "/workspace/src/app/apple-icon.png", 180);
const png32 = await sharp(Buffer.from(ANY_SVG)).resize(32, 32).png().toBuffer();
await writeFile("/workspace/src/app/favicon.ico", pngToIco(png32));
console.log("PWA icons written");
