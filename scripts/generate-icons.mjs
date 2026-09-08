// Generates every brand raster from the one source logo, so the whole set can
// be rebuilt with a single command when the artwork changes:
//
//   node scripts/generate-icons.mjs
//
// Source:  scripts/brand/logo-source.jpg  (square, artwork on a white field)
//
// Outputs:
//   public/logo.png        light-mode wordmark, white field knocked out
//   public/logo-light.png  dark-mode variant (the neutral ink is inverted so the
//                          black half of the mark stays visible on a dark page;
//                          the red is left alone because it reads on both)
//   public/icons/icon-*        "any"      — logo on a white round badge
//   public/icons/maskable-*    "maskable" — full-bleed white square, glyph inside
//                              the 80% safe zone so Android can crop to any shape
//   public/icons/apple-touch-icon.png     — square, no alpha (iOS ignores it)
//   public/fav.png                        — small favicon raster
import sharp from "sharp";
import fs from "node:fs";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const SRC = path.join(here, "brand", "logo-source.jpg");
const iconsOut = path.join(root, "public", "icons");
const publicOut = path.join(root, "public");
await mkdir(iconsOut, { recursive: true });

// The mark sits on a white field. A plain threshold would also punch holes in
// the white *inside* the shield and the highlights on the letters, so instead
// flood-fill inwards from the border: only white connected to the edge is
// background. Everything enclosed by artwork survives.
const BG_MIN = 235; // a pixel this light in every channel can be background
const NEUTRAL_SAT = 45; // max channel spread still counted as grey/black/white

async function knockOutBackground() {
  const img = sharp(SRC).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const isBg = new Uint8Array(w * h);
  const stack = [];

  const looksWhite = (i) => {
    const o = i * ch;
    return data[o] >= BG_MIN && data[o + 1] >= BG_MIN && data[o + 2] >= BG_MIN;
  };

  for (let x = 0; x < w; x++) {
    stack.push(x, (h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    stack.push(y * w, y * w + (w - 1));
  }

  while (stack.length) {
    const i = stack.pop();
    if (isBg[i] || !looksWhite(i)) continue;
    isBg[i] = 1;
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }

  // Alpha out the background and record the bounding box of what remains.
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let i = 0; i < w * h; i++) {
    if (isBg[i]) {
      data[i * ch + 3] = 0;
      continue;
    }
    const x = i % w;
    const y = (i / w) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const cropped = await sharp(data, { raw: { width: w, height: h, channels: ch } })
    .extract({
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    })
    .png()
    .toBuffer();

  return cropped;
}

// Dark-mode variant: invert only the neutral (grey/black/white) pixels. The red
// half of the mark keeps its hue; the black half becomes white; the white inside
// the shield becomes dark so it sits on a dark page instead of glowing.
async function darkVariant(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    if (data[o + 3] === 0) continue;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min <= NEUTRAL_SAT) {
      data[o] = 255 - r;
      data[o + 1] = 255 - g;
      data[o + 2] = 255 - b;
    }
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

/** Logo centred on a field, at `scale` of the canvas. */
async function badge(logo, size, { round, scale }) {
  const inner = Math.round(size * scale);
  const art = await sharp(logo)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const field = round
    ? Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
           <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff"/>
         </svg>`
      )
    : null;

  const base = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: round ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 255, g: 255, b: 255, alpha: 1 },
    },
  });

  const layers = [];
  if (field) layers.push({ input: field });
  layers.push({ input: art, gravity: "centre" });

  return base.composite(layers).png().toBuffer();
}

const logo = await knockOutBackground();
const logoDark = await darkVariant(logo);

// The mark never renders larger than a sidebar row or an OG card, so cap the
// long edge and compress — the full-resolution source stays in scripts/brand.
const WEB_MAX = 640;
const web = (buf) =>
  sharp(buf)
    .resize(WEB_MAX, WEB_MAX, { fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, quality: 90 });

await web(logo).toFile(path.join(publicOut, "logo.png"));
await web(logoDark).toFile(path.join(publicOut, "logo-light.png"));

const jobs = [
  ["icons/icon-192.png", await badge(logo, 192, { round: true, scale: 0.82 })],
  ["icons/icon-512.png", await badge(logo, 512, { round: true, scale: 0.82 })],
  ["icons/maskable-192.png", await badge(logo, 192, { round: false, scale: 0.7 })],
  ["icons/maskable-512.png", await badge(logo, 512, { round: false, scale: 0.7 })],
  ["icons/apple-touch-icon.png", await badge(logo, 180, { round: false, scale: 0.8 })],
  ["fav.png", await badge(logo, 128, { round: true, scale: 0.86 })],
];

for (const [name, buf] of jobs) {
  const dest = path.join(publicOut, name);
  await sharp(buf).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(dest);
  console.log("wrote", path.relative(root, dest).replace(/\\/g, "/"));
}
console.log("wrote public/logo.png");
console.log("wrote public/logo-light.png");

/* ────────────────────────────── favicon ────────────────────────────── */
//
// The browser tab is 16px. The full logo is illegible there — the arc text
// turns to noise and you cannot tell it is CBG — so the tab gets a plain "C"
// monogram in the brand red instead, drawn as an arc so no font is needed.
//
// This must be written to src/app/favicon.ico: Next's file convention wins
// over anything declared in metadata.icons, so a stale file there silently
// overrides every icon generated above. (That is exactly how the old Synergy
// "S" survived the rebrand.)
const BRAND_RED = "#e80000"; // sampled from the logo artwork

function monogramSvg(size) {
  const k = size / 64;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <rect width="${size}" height="${size}" rx="${12 * k}" fill="${BRAND_RED}"/>
       <g transform="scale(${k})" fill="none" stroke="#ffffff" stroke-width="11" stroke-linecap="round">
         <path d="M 42.5 17.5 A 17.5 17.5 0 1 0 42.5 46.5"/>
       </g>
     </svg>`
  );
}

/** Packs PNGs into a multi-size .ico (PNG-embedded, supported since Vista). */
function buildIco(pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  pngs.forEach(({ size, data }, i) => {
    const at = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, at);
    dir.writeUInt8(size >= 256 ? 0 : size, at + 1);
    dir.writeUInt8(0, at + 2); // palette size
    dir.writeUInt8(0, at + 3); // reserved
    dir.writeUInt16LE(1, at + 4); // colour planes
    dir.writeUInt16LE(32, at + 6); // bits per pixel
    dir.writeUInt32LE(data.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });

  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

const icoSizes = [16, 32, 48];
const icoPngs = [];
for (const size of icoSizes) {
  icoPngs.push({ size, data: await sharp(monogramSvg(size)).png().toBuffer() });
}
const icoPath = path.join(root, "src", "app", "favicon.ico");
await sharp(monogramSvg(128))
  .png({ compressionLevel: 9 })
  .toFile(path.join(publicOut, "fav.png"));
fs.writeFileSync(icoPath, buildIco(icoPngs));
console.log("wrote src/app/favicon.ico  (16/32/48 C monogram)");
console.log("wrote public/fav.png");
