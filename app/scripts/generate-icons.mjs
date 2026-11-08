// Génère les icônes PNG de l'application à partir d'un SVG unique (nécessite Playwright).
// Usage : node scripts/generate-icons.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BORDEAUX = '#7A1F2E';
// Bouteille en trait blanc, contenue dans la zone sûre des icônes masquables (80 % central).
const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${BORDEAUX}"/>
  <g transform="translate(16.4 16.4) scale(2.8)" fill="none" stroke="#FFFFFF" stroke-width="1.5"
     stroke-linejoin="round" stroke-linecap="round">
    <path d="M10 2h4v4l2 3v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z"/>
    <path d="M8 13h8"/>
  </g>
</svg>`;

const targets = [
  ['icon-192x192.png', 192],
  ['icon-512x512.png', 512],
  ['icon-maskable-512x512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32x32.png', 32],
];

const outDir = new URL('../public/icons/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [name, size] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(size)}</body></html>`);
  await page.locator('svg').screenshot({ path: new URL(name, outDir).pathname, omitBackground: false });
  console.log(`icons/${name}`);
}
await browser.close();
