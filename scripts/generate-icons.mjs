// Generates the PWA icon set into public/icons from a vector definition, so
// every size is crisp (the old fav.png was a 128px raster).
//
//   node scripts/generate-icons.mjs
//
// Two variants per size, as the manifest needs both:
//   icon-*.png      "any"      — round badge on transparent, for browsers/desktops
//   maskable-*.png  "maskable" — full-bleed square; Android crops it to its own
//                                shape, so the glyph sits inside the 80% safe zone.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "public", "icons");
await mkdir(out, { recursive: true });

const INK = "#0a0a0a";
const ACCENT = "#f26a1b"; // the bolt orange from the wordmark
const PAPER = "#ffffff";

/** The "S" with a bolt through it, drawn as paths so no font is needed. */
function glyph(size, color, boltColor) {
  const s = size / 512;
  // A chunky S made of two arcs, plus a lightning bolt across the middle.
  return `
    <g transform="scale(${s})" fill="none" stroke="${color}" stroke-width="58" stroke-linecap="round" stroke-linejoin="round">
      <path d="M340 168 C 320 128, 200 118, 176 178 C 152 238, 228 246, 262 254 C 322 268, 372 292, 346 350 C 322 402, 200 398, 168 352"/>
    </g>
    <g transform="scale(${s})">
      <path d="M286 122 L 214 268 L 262 268 L 226 390 L 306 232 L 258 232 Z" fill="${boltColor}" stroke="${boltColor}" stroke-width="6" stroke-linejoin="round"/>
    </g>`;
}

function badgeSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${INK}"/>
    ${glyph(size, PAPER, ACCENT)}
  </svg>`;
}

function maskableSvg(size) {
  // Glyph scaled to ~72% so it clears the 80% safe zone with margin.
  const inner = size * 0.72;
  const offset = (size - inner) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${INK}"/>
    <g transform="translate(${offset} ${offset})">${glyph(inner, PAPER, ACCENT)}</g>
  </svg>`;
}

const jobs = [
  ["icon-192.png", badgeSvg(192)],
  ["icon-512.png", badgeSvg(512)],
  ["maskable-192.png", maskableSvg(192)],
  ["maskable-512.png", maskableSvg(512)],
  ["apple-touch-icon.png", maskableSvg(180)],
];

for (const [name, svg] of jobs) {
  await sharp(Buffer.from(svg)).png().toFile(path.join(out, name));
  console.log("wrote", path.join("public", "icons", name));
}
