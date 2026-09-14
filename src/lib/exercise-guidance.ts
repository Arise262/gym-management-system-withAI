/**
 * Turns a library exercise into the three things a member actually asks for:
 * what is this, how many should I do, and how do I not hurt myself.
 *
 * The bundled library (880+ movements) ships instructions and structured tags —
 * category, level, mechanic, force, equipment, muscles — but no prose
 * description and no rep prescription. Rather than hand-write one of each for
 * every row, this derives them from the tags. The tags are the same facts a
 * coach would read off the exercise anyway, so the output is honest for every
 * row and never silently missing.
 *
 * Pure functions over plain data: no DB, no model call, safe on the server or
 * in the client bundle.
 */

export type GuidanceExercise = {
  name: string;
  category: string | null;
  level: string | null;
  mechanic: string | null;
  force: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
};

export type Prescription = {
  /** e.g. "3-4 sets" */
  sets: string;
  /** e.g. "6-10 reps", or a hold/duration where reps make no sense */
  reps: string;
  /** e.g. "90-120 seconds" */
  rest: string;
  /** Lifting tempo, only where it is meaningful. */
  tempo?: string;
  /** How often this belongs in a week. */
  frequency: string;
  /** One sentence on picking the load and judging the set. */
  load: string;
};

/* ------------------------------------------------------------------ */
/* Small English helpers                                              */
/* ------------------------------------------------------------------ */

function joinList(items: string[]): string {
  const clean = items.map((m) => m.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Expert" reads as gatekeeping on a member-facing page. */
export function displayLevel(level: string | null): string {
  const l = level?.toLowerCase().trim();
  if (!l) return "all levels";
  return l === "expert" ? "advanced" : l;
}

/** `${withArticle("intermediate")}` -> "an intermediate". */
export function withArticle(word: string): string {
  return `${article(word)} ${word}`;
}

/* ------------------------------------------------------------------ */
/* Description                                                        */
/* ------------------------------------------------------------------ */

/** What the category is, said the way a member would say it. */
const CATEGORY_NOUN: Record<string, string> = {
  strength: "strength exercise",
  stretching: "mobility drill",
  cardio: "conditioning exercise",
  plyometrics: "explosive power drill",
  powerlifting: "powerlifting movement",
  "olympic weightlifting": "olympic weightlifting movement",
  strongman: "strongman lift",
};

/** Why you would put it in a programme at all. */
const CATEGORY_PURPOSE: Record<string, string> = {
  strength:
    "Its job in a programme is building muscle and usable strength, so the load should be hard but controlled.",
  stretching:
    "Use it to open up tight tissue before a session or to wind down afterwards — it is not meant to be strenuous.",
  cardio:
    "Its job is raising your heart rate and building the engine that carries you through the rest of your training.",
  plyometrics:
    "It trains speed and explosiveness, so the quality of each rep matters far more than the number of them.",
  powerlifting:
    "It is a competition lift or a direct accessory to one — heavy loads, low reps, long rests.",
  "olympic weightlifting":
    "It is technical and speed-driven: the bar should move fast, so never load it heavy enough to grind.",
  strongman:
    "It is an odd-object or loaded-carry event — heavy, brief, and far more taxing than it looks on paper.",
};

const FORCE_PHRASE: Record<string, string> = {
  push: "The effort is a push: you drive the resistance away from your body.",
  pull: "The effort is a pull: you draw the resistance toward your body.",
  static: "There is no movement through the joint — you hold a position under tension.",
};

const MECHANIC_PHRASE: Record<string, string> = {
  compound:
    "It moves several joints at once, so it trains a lot of muscle for the time it costs.",
  isolation:
    "It works one joint in one direction, which makes it useful for targeting a weak point.",
};

function equipmentPhrase(equipment: string | null): string {
  const e = equipment?.toLowerCase().trim();
  if (!e || e === "body only") return "performed with just your bodyweight";
  if (e === "other") return "performed with basic gym equipment";
  if (e === "exercise ball") return "performed on a stability ball";
  if (e === "foam roll") return "performed on a foam roller";
  if (e === "bands") return "performed with resistance bands";
  if (e === "cable") return "performed on a cable machine";
  if (e === "machine") return "performed on a machine";
  if (e === "medicine ball") return "performed with a medicine ball";
  if (e === "e-z curl bar") return "performed with an EZ-curl bar";
  return `performed with ${article(e)} ${e}`;
}

/**
 * A short plain-English description. Every clause is sourced from a tag, so
 * nothing here is invented for the sake of filling the paragraph.
 */
export function exerciseDescription(ex: GuidanceExercise): string {
  const category = ex.category?.toLowerCase().trim() ?? "";
  const level = ex.level?.toLowerCase().trim() ?? "";
  const mechanic = ex.mechanic?.toLowerCase().trim() ?? "";
  const force = ex.force?.toLowerCase().trim() ?? "";

  const noun = CATEGORY_NOUN[category] ?? "exercise";
  const subject = level ? `${displayLevel(level)} ${noun}` : noun;
  const opener = `${capitalise(article(subject))} ${subject}, ${equipmentPhrase(ex.equipment)}.`;

  const primary = joinList(ex.primaryMuscles ?? []);
  const secondary = joinList(ex.secondaryMuscles ?? []);
  let muscles = "";
  if (primary && secondary) {
    muscles = `It works the ${primary}, with the ${secondary} assisting.`;
  } else if (primary) {
    muscles = `It works the ${primary}.`;
  }

  return [
    opener,
    muscles,
    MECHANIC_PHRASE[mechanic] ?? "",
    FORCE_PHRASE[force] ?? "",
    CATEGORY_PURPOSE[category] ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** A one-line version, for cards and lists. */
export function exerciseSummary(ex: GuidanceExercise): string {
  const primary = joinList(ex.primaryMuscles ?? []);
  const noun = CATEGORY_NOUN[ex.category?.toLowerCase().trim() ?? ""] ?? "exercise";
  const kit = equipmentPhrase(ex.equipment);
  return primary
    ? `${capitalise(noun)} for the ${primary}, ${kit}.`
    : `${capitalise(noun)} ${kit}.`;
}

/* ------------------------------------------------------------------ */
/* Sets and reps                                                      */
/* ------------------------------------------------------------------ */

/**
 * Rep ranges follow ordinary strength-and-conditioning practice: hypertrophy
 * ranges for accessory work, low reps and long rests for maximal and technical
 * lifts, timed holds for mobility and isometrics, and quality-capped volume for
 * plyometrics. Level shifts volume up and reps down as competence grows.
 */
function strengthPrescription(level: string, mechanic: string): Prescription {
  const isolation = mechanic === "isolation";

  if (level === "expert") {
    return isolation
      ? {
          sets: "3-4 sets",
          reps: "8-12 reps",
          rest: "45-75 seconds",
          tempo: "2 seconds down, 1 second up",
          frequency: "2-3 times a week",
          load: "Pick a weight that leaves you one or two reps short of failure at the top of the range.",
        }
      : {
          sets: "4-5 sets",
          reps: "5-8 reps",
          rest: "2-3 minutes",
          tempo: "2 seconds down, drive up",
          frequency: "2-3 times a week",
          load: "Work close to a heavy set — the last rep should be slow but still clean.",
        };
  }

  if (level === "intermediate") {
    return isolation
      ? {
          sets: "3 sets",
          reps: "10-15 reps",
          rest: "45-60 seconds",
          tempo: "2 seconds down, 1 second up",
          frequency: "2-3 times a week",
          load: "Heavy enough that the last two reps are a genuine effort.",
        }
      : {
          sets: "3-4 sets",
          reps: "6-10 reps",
          rest: "90-120 seconds",
          tempo: "2 seconds down, drive up",
          frequency: "2-3 times a week",
          load: "Add weight once you hit the top of the rep range on every set with clean form.",
        };
  }

  // beginner, or level not recorded
  return isolation
    ? {
        sets: "2-3 sets",
        reps: "12-15 reps",
        rest: "45-60 seconds",
        tempo: "2 seconds down, 1 second up",
        frequency: "2 times a week",
        load: "Start light. You should finish every set feeling you had two more reps in you.",
      }
    : {
        sets: "3 sets",
        reps: "8-12 reps",
        rest: "60-90 seconds",
        tempo: "2 seconds down, 1 second up",
        frequency: "2-3 times a week",
        load: "Start light and add weight only once all three sets feel controlled.",
      };
}

export function exercisePrescription(ex: GuidanceExercise): Prescription {
  const category = ex.category?.toLowerCase().trim() ?? "";
  const level = ex.level?.toLowerCase().trim() ?? "beginner";
  const mechanic = ex.mechanic?.toLowerCase().trim() ?? "compound";
  const force = ex.force?.toLowerCase().trim() ?? "";

  if (category === "stretching") {
    return {
      sets: "2-3 sets",
      reps: "hold 20-45 seconds",
      rest: "20-30 seconds",
      frequency: "daily, or after every session",
      load: "Stretch to mild tension and keep breathing — never into pain, and never bounce.",
    };
  }

  if (category === "cardio") {
    // Machine and outdoor pieces are done for time; bodyweight conditioning
    // like burpees is counted in reps, and prescribing 30 minutes of them
    // would be nonsense.
    const timed = (ex.equipment ?? "").toLowerCase().trim() !== "body only";
    return timed
      ? {
          sets: "1-3 rounds",
          reps: "10-30 minutes",
          rest: "as needed between rounds",
          frequency: "3-5 times a week",
          load: "Steady work should let you hold a conversation; intervals should not.",
        }
      : {
          sets: "3-5 rounds",
          reps: "10-20 reps",
          rest: "60-90 seconds",
          frequency: "2-4 times a week",
          load: "Keep the pace you could hold for every round, not just the first one.",
        };
  }

  if (category === "plyometrics") {
    return {
      sets: level === "beginner" ? "2-3 sets" : "3-5 sets",
      reps: level === "beginner" ? "5-8 reps" : "3-6 reps",
      rest: "2-3 minutes",
      frequency: "1-2 times a week",
      load: "Stop the set the moment reps stop being explosive — fatigue defeats the point.",
    };
  }

  if (category === "powerlifting") {
    return {
      sets: "4-6 sets",
      reps: level === "beginner" ? "3-5 reps" : "1-5 reps",
      rest: "3-5 minutes",
      frequency: "1-2 times a week",
      load: "Build up in warm-up sets, and keep a rep or two in reserve unless you are testing.",
    };
  }

  if (category === "olympic weightlifting") {
    return {
      sets: "5-6 sets",
      reps: "1-3 reps",
      rest: "2-3 minutes",
      frequency: "1-3 times a week",
      load: "Light enough to move fast. If the bar slows down, the set is over.",
    };
  }

  if (category === "strongman") {
    // Carries and holds are measured in distance or time. The source library
    // leaves `force` empty on most of them, so fall back to the name.
    const isCarry = force === "static" || /\b(walk|carry|hold|drag)\b/i.test(ex.name);
    return {
      sets: "3-5 sets",
      reps: isCarry ? "20-40 metres, or a 20-30 second carry" : "3-6 reps",
      rest: "2-4 minutes",
      frequency: "1-2 times a week",
      load: "Heavy, but never sloppy — put it down before your back rounds.",
    };
  }

  // Isometric strength work: time under tension, not repetitions.
  if (force === "static") {
    return {
      sets: "3 sets",
      reps: "hold 20-45 seconds",
      rest: "45-60 seconds",
      frequency: "2-3 times a week",
      load: "Add time before you add weight, and end the hold when the position starts to sag.",
    };
  }

  return strengthPrescription(level, mechanic);
}

/* ------------------------------------------------------------------ */
/* Form and safety cues                                               */
/* ------------------------------------------------------------------ */

const CATEGORY_TIPS: Record<string, string[]> = {
  stretching: [
    "Ease in and hold — bouncing makes the muscle tighten up, not loosen.",
    "Keep breathing slowly; holding your breath stops the tissue relaxing.",
  ],
  cardio: [
    "Warm up for a few minutes before pushing the pace.",
    "Pace it so you could manage another round — chasing a hard first round usually costs the session.",
  ],
  plyometrics: [
    "Land softly through the whole foot with your knees bent — absorb it, don't slap it.",
    "Rest fully between sets. Tired plyometrics are just slow reps with the injury risk kept in.",
  ],
  powerlifting: [
    "Work up in warm-up sets rather than jumping straight to your working weight.",
    "Use a spotter or safety pins on anything heavy you could get pinned under.",
  ],
  "olympic weightlifting": [
    "Drill the movement with an empty bar before you load it.",
    "Learn to bail: step away and let the bar drop rather than trying to save a bad rep.",
  ],
  strongman: [
    "Set your back before you pick anything up, and keep it set the whole way.",
    "Put the load down under control instead of dropping it out of a rounded position.",
  ],
};

const EQUIPMENT_TIPS: Record<string, string> = {
  barbell: "Use collars, and never load more than you can rack or bail out of safely.",
  dumbbell: "Control the weights on the way down — that half of the rep is where the growth is.",
  kettlebell: "Keep the bell close to your body; letting it drift out loads your lower back instead.",
  cable: "Set the pulley height first so the line of pull matches the muscle you are training.",
  machine: "Adjust the seat and pads so the joint you are training lines up with the machine's pivot.",
  bands: "Anchor the band securely and stay out of its snap-back path.",
  "body only": "When bodyweight gets easy, slow the reps down before you add more of them.",
  "medicine ball": "Check nobody is standing where the ball is going to land.",
  "exercise ball": "Check the ball is firm and on non-slip flooring before you get on it.",
  "foam roll": "Roll slowly and pause on the tight spots; racing over them does nothing.",
};

const MUSCLE_TIPS: { muscles: string[]; tip: string }[] = [
  {
    muscles: ["lower back", "middle back", "traps", "lats"],
    tip: "Brace your abs and keep a neutral spine — a rounding back is the first thing to fix here.",
  },
  {
    muscles: ["shoulders"],
    tip: "Keep your shoulder blades set down and back rather than shrugging into the rep.",
  },
  {
    muscles: ["quadriceps", "hamstrings", "glutes"],
    tip: "Track your knees over your toes and keep your heels down.",
  },
  {
    muscles: ["abdominals"],
    tip: "Pull your ribs toward your hips instead of yanking on your neck.",
  },
  { muscles: ["neck"], tip: "Move slowly, and never load your neck into its end range." },
  {
    muscles: ["forearms", "biceps", "triceps"],
    tip: "Keep your wrist straight; letting it bend under load is what causes elbow pain.",
  },
  {
    muscles: ["calves"],
    tip: "Pause at the top and take a full stretch at the bottom — short reps waste the set.",
  },
];

const UNIVERSAL_TIPS = {
  endSet: "End the set when your form breaks, not when the rep count runs out.",
  pain: "Sharp pain is not muscular effort. Stop, and ask a trainer before you try again.",
};

/** Up to five cues, most specific first. */
export function exerciseTips(ex: GuidanceExercise): string[] {
  const tips: string[] = [];
  const category = ex.category?.toLowerCase().trim() ?? "";
  const equipment = ex.equipment?.toLowerCase().trim() ?? "";
  const level = ex.level?.toLowerCase().trim() ?? "";
  const involved = [...(ex.primaryMuscles ?? []), ...(ex.secondaryMuscles ?? [])].map((m) =>
    m.toLowerCase()
  );

  // Loading cues are about lifting. On a stretch or a cardio piece they read
  // as noise at best and as wrong advice at worst.
  const isLoaded = category !== "stretching" && category !== "cardio";

  if (isLoaded) {
    for (const rule of MUSCLE_TIPS) {
      if (ex.primaryMuscles?.some((m) => rule.muscles.includes(m.toLowerCase()))) {
        tips.push(rule.tip);
        break;
      }
    }
  }

  tips.push(...(CATEGORY_TIPS[category] ?? []));

  // Strongman already gets two cues about setting and keeping your back, which
  // is the same ground the equipment cue would cover.
  if (isLoaded && category !== "strongman" && EQUIPMENT_TIPS[equipment])
    tips.push(EQUIPMENT_TIPS[equipment]);

  if (level === "expert") {
    tips.push("This one is demanding — have someone watch your first few sets before you load it up.");
  }

  if (involved.includes("lower back") && category !== "stretching") {
    tips.push("Do not let your lower back round under load, even on the last rep.");
  }

  if (isLoaded) tips.push(UNIVERSAL_TIPS.endSet);
  tips.push(UNIVERSAL_TIPS.pain);

  return [...new Set(tips)].slice(0, 5);
}
