// Rasterizes public/favicon.svg into the PNG icon set the PWA manifest needs.
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url));
const render = (size) => sharp(svg, { density: 300 }).resize(size, size).png();

await render(192).toFile('public/icon-192.png');
await render(512).toFile('public/icon-512.png');
await render(180).toFile('public/apple-touch-icon.png');

// Maskable: glyph shrunk into the 80% safe zone on a full-bleed background.
await sharp(svg, { density: 300 })
  .resize(410, 410)
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: '#0f1216' })
  .png()
  .toFile('public/icon-maskable-512.png');

console.log('icons generated');
