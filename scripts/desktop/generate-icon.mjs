#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../..');
const sourcePath = resolve(repositoryRoot, 'public/favicon.svg');
const outputPath = resolve(
  repositoryRoot,
  'desktop/packaging/assets/nazca.ico',
);
const sizes = [16, 24, 32, 48, 64, 128, 256];

function iconDirectoryEntry(size, bytes, offset) {
  const entry = Buffer.alloc(16);
  entry[0] = size === 256 ? 0 : size;
  entry[1] = size === 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(bytes.length, 8);
  entry.writeUInt32LE(offset, 12);
  return entry;
}

function validateIco(buffer) {
  if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1)
    throw new Error('generated icon has an invalid ICO header');
  const count = buffer.readUInt16LE(4);
  if (count !== sizes.length)
    throw new Error(
      `generated icon contains ${count} frames, expected ${sizes.length}`,
    );
  const seen = new Set();
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    const width = buffer[offset] || 256;
    const height = buffer[offset + 1] || 256;
    if (width !== height || !sizes.includes(width))
      throw new Error(
        `generated icon contains unexpected ${width}x${height} frame`,
      );
    seen.add(width);
  }
  if (seen.size !== sizes.length)
    throw new Error('generated icon frame sizes are not distinct');
}

const svg = await readFile(sourcePath);
const frames = [];
for (const size of sizes) {
  const png = await sharp(svg, { density: Math.max(72, size * 4) })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 })
    .toBuffer();
  const metadata = await sharp(png).metadata();
  if (
    metadata.format !== 'png' ||
    metadata.width !== size ||
    metadata.height !== size
  ) {
    throw new Error(
      `generated ${size}x${size} frame did not round-trip as PNG`,
    );
  }
  frames.push(png);
}

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
const directory = [];
let dataOffset = header.length + frames.length * 16;
for (let index = 0; index < frames.length; index += 1) {
  directory.push(iconDirectoryEntry(sizes[index], frames[index], dataOffset));
  dataOffset += frames[index].length;
}
const ico = Buffer.concat([header, ...directory, ...frames]);
validateIco(ico);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, ico);
console.log(`Generated ${outputPath} from ${sourcePath}`);
console.log(`Frames: ${sizes.join(', ')} px, format: lossless PNG-in-ICO`);
