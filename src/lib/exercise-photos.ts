/**
 * Which photo each library exercise shows.
 *
 * Every picture in the exercise library is one shot at CBG itself, on CBG's
 * own equipment — not the stock photography that came with the vendored
 * library. There are 15 photo sets (a start and a finish shot each) and 890
 * exercises, so:
 *
 *   - an exercise that IS one of the photographed movements shows its own set
 *     (MATCHED below, checked by hand);
 *   - every other exercise borrows a set that works the same muscle, picked by
 *     a hash of its id. That is random in the sense of arbitrary, but stable:
 *     the card, the detail page and the database always agree, and nothing
 *     reshuffles on a rebuild.
 *
 * isOwnPhoto() tells the two apart, so the detail page does not label a hip
 * thrust as the "start" of a squat.
 *
 * The files themselves are produced by scripts/exercise-photos.mjs. Pure data
 * and plain functions — no path aliases, so the prisma seed scripts can import
 * it too.
 */

const SETS = [
  "cable-chest-fly",
  "dumbbell-front-raise",
  "incline-dumbbell-press",
  "indoor-cycling",
  "lat-pulldown-wide",
  "lat-pulldown-close",
  "machine-chest-fly",
  "machine-chest-press",
  "machine-hip-thrust",
  "pull-up",
  "seated-cable-row",
  "seated-dumbbell-shoulder-press",
  "t-bar-row",
  "treadmill",
  "decline-sit-up",
] as const;

type PhotoSet = (typeof SETS)[number];

/** Library ids whose photos show that exact movement (or a grip variant of it). */
const MATCHED: Record<string, PhotoSet> = {
  Cable_Crossover: "cable-chest-fly",
  Low_Cable_Crossover: "cable-chest-fly",
  "Single-Arm_Cable_Crossover": "cable-chest-fly",

  Front_Dumbbell_Raise: "dumbbell-front-raise",
  "Front_Two-Dumbbell_Raise": "dumbbell-front-raise",
  Alternating_Deltoid_Raise: "dumbbell-front-raise",

  Incline_Dumbbell_Press: "incline-dumbbell-press",
  Incline_Dumbbell_Bench_With_Palms_Facing_In: "incline-dumbbell-press",

  Bicycling_Stationary: "indoor-cycling",
  Bicycling: "indoor-cycling",
  Recumbent_Bike: "indoor-cycling",
  Air_Bike_Intervals: "indoor-cycling",

  "Wide-Grip_Lat_Pulldown": "lat-pulldown-wide",
  "Full_Range-Of-Motion_Lat_Pulldown": "lat-pulldown-wide",
  "Wide-Grip_Pulldown_Behind_The_Neck": "lat-pulldown-wide",
  "Close-Grip_Front_Lat_Pulldown": "lat-pulldown-close",
  "V-Bar_Pulldown": "lat-pulldown-close",
  Underhand_Cable_Pulldowns: "lat-pulldown-close",

  Butterfly: "machine-chest-fly",

  Machine_Bench_Press: "machine-chest-press",
  Leverage_Chest_Press: "machine-chest-press",
  Leverage_Incline_Chest_Press: "machine-chest-press",

  Barbell_Hip_Thrust: "machine-hip-thrust",
  Barbell_Glute_Bridge: "machine-hip-thrust",
  Smith_Machine_Hip_Raise: "machine-hip-thrust",

  Pullups: "pull-up",
  Weighted_Pull_Ups: "pull-up",
  "Wide-Grip_Rear_Pull-Up": "pull-up",
  "Band_Assisted_Pull-Up": "pull-up",
  "Chin-Up": "pull-up",
  Mixed_Grip_Chin: "pull-up",
  Dead_Hang: "pull-up",

  Seated_Cable_Rows: "seated-cable-row",
  "Seated_One-arm_Cable_Pulley_Rows": "seated-cable-row",
  Elevated_Cable_Rows: "seated-cable-row",

  Seated_Dumbbell_Press: "seated-dumbbell-shoulder-press",
  Dumbbell_Shoulder_Press: "seated-dumbbell-shoulder-press",
  Arnold_Dumbbell_Press: "seated-dumbbell-shoulder-press",

  "T-Bar_Row_with_Handle": "t-bar-row",

  Jogging_Treadmill: "treadmill",
  Running_Treadmill: "treadmill",
  Walking_Treadmill: "treadmill",

  "Sit-Up": "decline-sit-up",
  "3_4_Sit-Up": "decline-sit-up",
  Decline_Crunch: "decline-sit-up",
  "Weighted_Sit-Ups_-_With_Bands": "decline-sit-up",
};

/** What a movement that was not photographed borrows, by its main muscle. */
const BY_MUSCLE: Record<string, PhotoSet[]> = {
  chest: ["cable-chest-fly", "machine-chest-fly", "machine-chest-press", "incline-dumbbell-press"],
  shoulders: ["dumbbell-front-raise", "seated-dumbbell-shoulder-press"],
  triceps: ["machine-chest-press", "seated-dumbbell-shoulder-press", "incline-dumbbell-press"],
  lats: ["lat-pulldown-wide", "lat-pulldown-close", "pull-up"],
  "middle back": ["seated-cable-row", "t-bar-row"],
  "lower back": ["t-bar-row"],
  traps: ["t-bar-row", "seated-cable-row"],
  biceps: ["pull-up", "lat-pulldown-close", "seated-cable-row"],
  forearms: ["pull-up", "t-bar-row"],
  neck: ["seated-dumbbell-shoulder-press", "dumbbell-front-raise"],
  abdominals: ["decline-sit-up"],
  glutes: ["machine-hip-thrust"],
  hamstrings: ["machine-hip-thrust"],
  adductors: ["machine-hip-thrust"],
  abductors: ["machine-hip-thrust"],
  quadriceps: ["machine-hip-thrust", "indoor-cycling"],
  calves: ["machine-hip-thrust", "indoor-cycling"],
};

const CARDIO: PhotoSet[] = ["treadmill", "indoor-cycling"];

export type PhotoSubject = {
  id: string;
  category?: string | null;
  primaryMuscles?: string[] | null;
};

/** FNV-1a — a tiny, stable string hash; nothing here needs to be secure. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function setFor(e: PhotoSubject): PhotoSet {
  const own = MATCHED[e.id];
  if (own) return own;

  const muscle = e.primaryMuscles?.[0]?.toLowerCase() ?? "";
  const pool =
    e.category === "cardio" ? CARDIO : (BY_MUSCLE[muscle] ?? (SETS as readonly PhotoSet[]));
  return pool[hash(e.id) % pool.length];
}

/** Image paths, relative to /exercises, in start → finish order. */
export function exercisePhotos(e: PhotoSubject): string[] {
  const set = setFor(e);
  return [`cbg/${set}/0.jpg`, `cbg/${set}/1.jpg`];
}

/** True when the photos show this exact movement, not a borrowed one. */
export function isOwnPhoto(id: string): boolean {
  return id in MATCHED;
}
