// Copies the exercise photos shot at the gym into public/, renamed and
// recompressed, so the library can serve them:
//
//   node scripts/exercise-photos.mjs
//
// Source:  images/images/<folder>/*.jpg   (straight off the phone)
// Output:  public/exercises/cbg/<set>/0.jpg  start position
//          public/exercises/cbg/<set>/1.jpg  finish position
//
// Which exercise shows which set is decided in src/lib/exercise-photos.ts —
// the set names below must match the ones listed there. To add a movement:
// drop its folder into images/images, add a row here, add its set to the lib,
// re-run this, then `npm run db:sync:exercise-photos`.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const SRC = path.join(root, "images", "images");
const OUT = path.join(root, "public", "exercises", "cbg");

// [start, finish]. The phone's file order is not the movement's order — in
// five of these folders the finish shot was taken first — so each pair was
// checked by eye.
const SETS = {
  "cable-chest-fly": ["cable_chest_fly", "6143030649493853069.jpg", "6143030649493853068.jpg"],
  "dumbbell-front-raise": ["dumbbell_front_raise", "6143030649493853022.jpg", "6143030649493853021.jpg"],
  "incline-dumbbell-press": ["Incline_Dumbell_Press", "6143030649493853020.jpg", "6143030649493853023.jpg"],
  "indoor-cycling": ["indoor_cycling_workout", "6143030649493853057.jpg", "6143030649493853059.jpg"],
  "lat-pulldown-wide": ["Lat_Pulldown", "6143030649493853028 (1).jpg", "6143030649493853029 (1).jpg"],
  "lat-pulldown-close": ["Lat_Pulldown", "6143030649493853042.jpg", "6143030649493853043.jpg"],
  "machine-chest-fly": ["machine_chest_fly", "6143030649493853046.jpg", "6143030649493853045.jpg"],
  "machine-chest-press": ["Machine_Chest_Press", "6143030649493853035.jpg", "6143030649493853034.jpg"],
  "machine-hip-thrust": ["machine_hip_thrust", "6143030649493853064.jpg", "6143030649493853065.jpg"],
  "pull-up": ["pull_up", "6143030649493853072.jpg", "6143030649493853073.jpg"],
  "seated-cable-row": ["Seated_Cable_Row", "6143030649493853031.jpg", "6143030649493853030.jpg"],
  "seated-dumbbell-shoulder-press": ["seated_dumbbell shoulder_press", "6143030649493853058 (1).jpg", "6143030649493853056.jpg"],
  "t-bar-row": ["standing_T-bar_row", "6143030649493853066.jpg", "6143030649493853067.jpg"],
  "treadmill": ["treadmill", "6143030649493853060.jpg", "6143030649493853061.jpg"],
  "decline-sit-up": ["weighted_decline_sit-up", "6143030649493853070.jpg", "6143030649493853071.jpg"],
};

let bytes = 0;
for (const [set, [folder, ...shots]] of Object.entries(SETS)) {
  await mkdir(path.join(OUT, set), { recursive: true });
  for (const [i, file] of shots.entries()) {
    const info = await sharp(path.join(SRC, folder, file))
      .rotate() // honour EXIF orientation before it is stripped
      .resize({ width: 1280, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(path.join(OUT, set, `${i}.jpg`));
    bytes += info.size;
  }
}
console.log(`${Object.keys(SETS).length} sets written to public/exercises/cbg (${(bytes / 1e6).toFixed(1)} MB)`);
