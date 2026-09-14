import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    CheckCircle2,
    Dumbbell,
    Target,
    Award,
    ChevronRight,
    ArrowLeft,
    Repeat,
    Timer,
    CalendarDays,
    Lightbulb,
    Info,
} from 'lucide-react'
import { getExercise, getRelatedExercises } from '@/action/exercise.2.action'
import {
    exerciseDescription,
    exercisePrescription,
    exerciseTips,
    displayLevel,
    withArticle,
} from '@/lib/exercise-guidance'
import { isOwnPhoto } from '@/lib/exercise-photos'

type Props = {
    params: Promise<{ exercise_id: string }>
}

export async function generateMetadata({ params }: Props) {
    const { exercise_id } = await params
    const exercise = getExercise(exercise_id)
    return { title: exercise ? `${exercise.name} — Exercise Library` : 'Exercise not found' }
}

const ExercisePage = async ({ params }: Props) => {
    const { exercise_id } = await params
    const exercise = getExercise(exercise_id)

    // Previously this component returned undefined for an unknown slug, which
    // React renders as a blank page. A 404 is the honest answer.
    if (!exercise) notFound()

    const description = exerciseDescription(exercise)
    const rx = exercisePrescription(exercise)
    const tips = exerciseTips(exercise)
    const related = getRelatedExercises(exercise.id)
    const ownPhoto = isOwnPhoto(exercise.id)

    return (
        <div className="container mx-auto max-w-5xl px-4 py-8">
            <Link href="/member/workout">
                <Button variant="ghost" size="sm" className="-ml-2 mb-4">
                    <ArrowLeft className="mr-1 size-4" />
                    Exercise library
                </Button>
            </Link>

            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">{exercise.name}</h1>
                <div className="mt-2 flex flex-wrap gap-2">
                    {exercise.category && (
                        <Badge variant="secondary" className="capitalize">
                            {exercise.category}
                        </Badge>
                    )}
                    {exercise.level && (
                        <Badge variant="secondary" className="capitalize">
                            {displayLevel(exercise.level)}
                        </Badge>
                    )}
                    {exercise.force && (
                        <Badge variant="secondary" className="capitalize">
                            {exercise.force} movement
                        </Badge>
                    )}
                    {exercise.mechanic && (
                        <Badge variant="secondary" className="capitalize">
                            {exercise.mechanic}
                        </Badge>
                    )}
                </div>
            </div>

            {/* What this exercise is */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Info className="mr-2 h-5 w-5" />
                        What this exercise is
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="leading-relaxed">{description}</p>
                </CardContent>
            </Card>

            {/* Sets and reps */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Repeat className="mr-2 h-5 w-5" />
                        How many sets and reps
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <Stat icon={<Repeat className="h-4 w-4" />} label="Sets" value={rx.sets} />
                        <Stat icon={<Dumbbell className="h-4 w-4" />} label="Per set" value={rx.reps} />
                        <Stat icon={<Timer className="h-4 w-4" />} label="Rest between sets" value={rx.rest} />
                        <Stat
                            icon={<CalendarDays className="h-4 w-4" />}
                            label="How often"
                            value={rx.frequency}
                        />
                    </div>

                    {rx.tempo && (
                        <p className="text-sm">
                            <span className="text-muted-foreground">Tempo: </span>
                            {rx.tempo}
                        </p>
                    )}

                    <p className="text-sm">
                        <span className="text-muted-foreground">Picking your weight: </span>
                        {rx.load}
                    </p>

                    <p className="text-muted-foreground border-t pt-3 text-xs">
                        A general starting point, based on this being{' '}
                        {withArticle(displayLevel(exercise.level))} {exercise.mechanic ?? 'compound'}{' '}
                        movement. Your own plan or a CBG trainer may set something different — follow
                        that instead.
                    </p>
                </CardContent>
            </Card>

            {/* Images — shot at CBG. Only photos of this exact movement get
                Start/Finish labels; a borrowed one would be mislabelled. */}
            {exercise.images?.length > 0 && (
                <div className="mb-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {exercise.images.map((image, index) => (
                            <Card key={image} className="overflow-hidden p-0">
                                <div className="relative flex aspect-video items-center justify-center">
                                    <img
                                        src={`/exercises/${image}`}
                                        alt={`${exercise.name} — position ${index + 1}`}
                                        className="h-full w-full object-contain"
                                    />
                                    {ownPhoto && (
                                        <Badge className="absolute right-2 bottom-2">
                                            {index === 0 ? 'Start' : index === exercise.images.length - 1 ? 'Finish' : index + 1}
                                        </Badge>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                    {!ownPhoto && (
                        <p className="text-muted-foreground mt-2 text-xs">
                            Photos taken at CBG of a related movement for the same muscles — follow the
                            steps below for this exercise.
                        </p>
                    )}
                </div>
            )}

            {/* Instructions */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <CheckCircle2 className="mr-2 h-5 w-5" />
                        How to perform it
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {exercise.instructions?.length > 0 ? (
                        <ol className="space-y-4">
                            {exercise.instructions.map((instruction, index) => (
                                <li key={index} className="flex">
                                    <div className="mr-3 flex-shrink-0">
                                        <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium">
                                            {index + 1}
                                        </div>
                                    </div>
                                    <p className="pt-1 leading-relaxed">{instruction}</p>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="text-muted-foreground">
                            No step-by-step instructions recorded for this exercise yet. Ask a trainer to
                            walk you through it before your first set.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Muscles + equipment */}
            <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Target className="mr-2 h-5 w-5" />
                            Muscles worked
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-muted-foreground text-sm font-medium">Primary</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                                {exercise.primaryMuscles.length > 0 ? (
                                    exercise.primaryMuscles.map((muscle) => (
                                        <Badge key={muscle} className="capitalize">
                                            {muscle}
                                        </Badge>
                                    ))
                                ) : (
                                    <span className="text-muted-foreground text-sm">Not recorded</span>
                                )}
                            </div>
                        </div>
                        <div>
                            <p className="text-muted-foreground text-sm font-medium">Supporting</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                                {exercise.secondaryMuscles.length > 0 ? (
                                    exercise.secondaryMuscles.map((muscle) => (
                                        <Badge key={muscle} variant="secondary" className="capitalize">
                                            {muscle}
                                        </Badge>
                                    ))
                                ) : (
                                    <span className="text-muted-foreground text-sm">None</span>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Dumbbell className="mr-2 h-5 w-5" />
                            What you need
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-muted-foreground text-sm font-medium">Equipment</p>
                            <p className="capitalize">{exercise.equipment ?? 'None — bodyweight only'}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground text-sm font-medium">Suits</p>
                            <p className="flex items-center gap-1">
                                <Award className="h-4 w-4" />
                                {exercise.level === 'beginner'
                                    ? 'All fitness levels, including first-timers'
                                    : exercise.level === 'intermediate'
                                      ? 'Members already training regularly'
                                      : 'Experienced lifters, with a coach on hand'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tips */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Lightbulb className="mr-2 h-5 w-5" />
                        Form tips
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2">
                        {tips.map((tip) => (
                            <li key={tip} className="flex items-start">
                                <ChevronRight className="text-primary mt-0.5 mr-2 h-5 w-5 shrink-0" />
                                <span>{tip}</span>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>

            {/* Related */}
            {related.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Trains the same muscles</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {related.map((item) => (
                            <Link
                                key={item.id}
                                href={`/member/workout/${item.id}`}
                                className="hover:bg-accent flex items-center justify-between rounded-md border p-3 transition-colors"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-medium">{item.name}</p>
                                    <p className="text-muted-foreground truncate text-xs capitalize">
                                        {item.equipment ?? 'bodyweight'} · {displayLevel(item.level)}
                                    </p>
                                </div>
                                <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                            </Link>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="rounded-lg border p-3">
            <div className="text-muted-foreground flex items-center gap-1 text-xs">
                {icon}
                {label}
            </div>
            <p className="mt-1 font-semibold">{value}</p>
        </div>
    )
}

export default ExercisePage
