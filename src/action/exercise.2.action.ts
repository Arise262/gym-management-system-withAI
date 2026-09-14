import Data from './exercises.json'
import Additions from './exercises-2026.json'
import {
    exerciseSummary,
    type GuidanceExercise,
} from '@/lib/exercise-guidance'

/** One row of the bundled library, as it sits in exercises.json. */
export type LibraryExercise = GuidanceExercise & {
    id: string
    instructions: string[]
    images: string[]
}

/** Just enough to draw a card. */
export type ExerciseListItem = {
    id: string
    name: string
    category: string | null
    equipment: string | null
    level: string | null
    primaryMuscles: string[]
    image: string | null
    summary: string
}

/**
 * exercises.json is the vendored free-exercise-db dump and is left untouched so
 * it can be re-pulled. exercises-2026.json holds movements that have become
 * standard programming since that dump and were missing from it — Bulgarian
 * split squats, Nordics, Copenhagen planks, carries, burpees and so on. They
 * ship without photography, which the cards and detail page handle.
 */
const ALL = [...(Data as unknown as LibraryExercise[]), ...(Additions as LibraryExercise[])].sort(
    (a, b) => a.name.localeCompare(b.name)
)

function toListItem(e: LibraryExercise): ExerciseListItem {
    return {
        id: e.id,
        name: e.name,
        category: e.category,
        equipment: e.equipment,
        level: e.level,
        primaryMuscles: e.primaryMuscles ?? [],
        image: e.images?.[0] ?? null,
        summary: exerciseSummary(e),
    }
}

/**
 * Card-sized rows for the library grid.
 *
 * The list page is a server component handing its data to a client component,
 * so everything returned here is serialised into the RSC payload. Sending all
 * 880-odd rows in full — instructions included — is about a megabyte on the
 * wire for a grid that shows a name, an image and three tags. This projects to
 * the fields the card actually renders.
 */
export function getExercises(): ExerciseListItem[] {
    return ALL.map(toListItem)
}

export function getExercise(id: string): LibraryExercise | undefined {
    return ALL.find((e) => e.id === id)
}

/**
 * Other exercises hitting the same primary muscle, for the "train this again"
 * row at the bottom of a detail page. Same category first, since a member
 * looking at a stretch does not want a barbell lift suggested back.
 */
export function getRelatedExercises(id: string, limit = 6): ExerciseListItem[] {
    const source = getExercise(id)
    if (!source) return []

    const targets = (source.primaryMuscles ?? []).map((m) => m.toLowerCase())
    if (targets.length === 0) return []

    return ALL.filter(
        (e) =>
            e.id !== source.id &&
            (e.primaryMuscles ?? []).some((m) => targets.includes(m.toLowerCase()))
    )
        .sort((a, b) => {
            const rank = (e: LibraryExercise) => (e.category === source.category ? 0 : 1)
            return rank(a) - rank(b) || a.name.localeCompare(b.name)
        })
        .slice(0, limit)
        .map(toListItem)
}
