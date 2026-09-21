'use client'
import React, { useState, useMemo, useEffect } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from './ui/badge'
import { ArrowLeft, Dumbbell, ListFilter, Search } from 'lucide-react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import Link from 'next/link'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Image from 'next/image'
import type { ExerciseListItem } from '@/action/exercise.2.action'
import { displayLevel } from '@/lib/exercise-guidance'

type Props = {
    AllExercise: ExerciseListItem[]
}

const CATEGORIES = [
    'all',
    'strength',
    'stretching',
    'cardio',
    'plyometrics',
    'powerlifting',
    'olympic weightlifting',
    'strongman',
]

/** How many cards to mount at once. The library is 880+ entries and every card
 *  carries an image, so rendering the lot makes the first paint crawl. */
const PAGE_SIZE = 24

const WorkoutsList = ({ AllExercise }: Props) => {
    const [searchQuery, setSearchQuery] = useState('')
    const [activeCategory, setActiveCategory] = useState('all')
    const [equipment, setEquipment] = useState('all')
    const [visible, setVisible] = useState(PAGE_SIZE)

    /** Equipment options come from the data rather than a hand-kept list, so a
     *  new exercise with new kit shows up in the filter automatically. */
    const equipmentOptions = useMemo(() => {
        const set = new Set<string>()
        for (const e of AllExercise) if (e.equipment) set.add(e.equipment)
        return ['all', ...[...set].sort()]
    }, [AllExercise])

    const filteredExercises = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        return AllExercise.filter((exercise) => {
            // Search covers the muscle names too — "glutes" is how a member
            // looks for a glute exercise, not by remembering its name.
            const matchesSearch =
                query === '' ||
                exercise.name.toLowerCase().includes(query) ||
                exercise.primaryMuscles.some((m) => m.toLowerCase().includes(query))

            const matchesCategory =
                activeCategory === 'all' || exercise.category === activeCategory

            const matchesEquipment = equipment === 'all' || exercise.equipment === equipment

            return matchesSearch && matchesCategory && matchesEquipment
        })
    }, [AllExercise, searchQuery, activeCategory, equipment])

    // Any change to the filters starts the list over from the top.
    useEffect(() => {
        setVisible(PAGE_SIZE)
    }, [searchQuery, activeCategory, equipment])

    const shown = filteredExercises.slice(0, visible)

    return (
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            {/* The library is reached from the member home and is a dead end without
                this — there is no sidebar or bottom bar on the member screens, so the
                only way back was the browser's own button. */}
            <Link href="/member" className="-mb-2 inline-block">
                <Button variant="ghost" size="sm" className="-ml-2">
                    <ArrowLeft className="mr-1 size-4" />
                    Back
                </Button>
            </Link>

            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                    <Image src="/logo.png" width={40} height={40} alt="CBG Fitness Center" className="dark:hidden" />
                    <Image src="/logo-light.png" width={40} height={40} alt="CBG Fitness Center" className="hidden dark:block" />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Exercise Library</h1>
                        <p className="text-muted-foreground text-sm">
                            Tap any exercise for how to do it, and how many sets and reps.
                        </p>
                    </div>
                </div>

                <div className="relative w-full sm:w-1/2 lg:w-1/3">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                        placeholder="Search by name or muscle..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
                <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
                    {CATEGORIES.map((category) => (
                        <TabsTrigger key={category} value={category} className="py-2 text-sm capitalize">
                            {category === 'all' ? 'All' : category}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm">Equipment</span>
                {equipmentOptions.map((option) => (
                    <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant={equipment === option ? 'default' : 'outline'}
                        className="h-7 capitalize"
                        onClick={() => setEquipment(option)}
                    >
                        {option === 'all' ? 'Any' : option}
                    </Button>
                ))}
            </div>

            {filteredExercises.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ListFilter className="text-muted-foreground mb-4 h-12 w-12" />
                    <h3 className="text-lg font-medium">No exercises found</h3>
                    <p className="text-muted-foreground mt-2">
                        Try a different search term, or clear one of the filters.
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {shown.map((exercise) => (
                            <ExerciseCard key={exercise.id} exercise={exercise} />
                        ))}
                    </div>

                    {visible < filteredExercises.length && (
                        <div className="flex justify-center">
                            <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                                Show more exercises
                            </Button>
                        </div>
                    )}
                </>
            )}

            <div className="text-muted-foreground text-sm">
                Showing {shown.length} of {filteredExercises.length}{' '}
                {filteredExercises.length === 1 ? 'exercise' : 'exercises'}
                {activeCategory !== 'all' && ` in ${activeCategory}`}
                {equipment !== 'all' && ` using ${equipment}`}
                {searchQuery && ` matching "${searchQuery}"`}
            </div>
        </div>
    )
}

export default WorkoutsList

const ExerciseCard = ({ exercise }: { exercise: ExerciseListItem }) => {
    const [broken, setBroken] = useState(false)

    return (
        <Link href={`/member/workout/${exercise.id}`} className="h-full">
            <Card className="flex h-full w-full flex-col overflow-hidden pt-0 transition-all hover:shadow-lg">
                <div className="bg-muted relative h-48 w-full overflow-hidden">
                    {exercise.image && !broken ? (
                        <Image
                            src={`/exercises/${exercise.image}`}
                            width={600}
                            height={200}
                            alt={exercise.name}
                            className="h-full w-full rounded-t-md object-cover transition-transform duration-300 hover:scale-105"
                            onError={() => setBroken(true)}
                        />
                    ) : (
                        // Every exercise has a CBG photo now; this only shows if
                        // one fails to load. A placeholder beats a broken image icon.
                        <div className="text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-2">
                            <Dumbbell className="h-10 w-10 opacity-40" />
                            <span className="text-xs">No photo yet</span>
                        </div>
                    )}
                    {exercise.level && (
                        <Badge className="absolute top-2 right-2 capitalize">
                            {displayLevel(exercise.level)}
                        </Badge>
                    )}
                </div>
                <CardHeader className="flex-1 pb-2">
                    <CardTitle className="line-clamp-2 text-lg font-bold">{exercise.name}</CardTitle>
                    <CardDescription className="mt-2 space-y-2 text-sm">
                        <span className="line-clamp-2 block">{exercise.summary}</span>
                        <span className="flex flex-wrap gap-2">
                            <span className="flex items-center text-sm">
                                <ListFilter className="text-muted-foreground mr-1 h-4 w-4" />
                                <span className="text-muted-foreground capitalize">{exercise.category}</span>
                            </span>
                            <span className="flex items-center text-sm">
                                <Dumbbell className="text-muted-foreground mr-1 h-4 w-4" />
                                <span className="text-muted-foreground capitalize">
                                    {exercise.equipment ?? 'bodyweight'}
                                </span>
                            </span>
                        </span>
                        <span className="flex flex-wrap gap-1">
                            {exercise.primaryMuscles.slice(0, 2).map((muscle) => (
                                <Badge key={muscle} variant="secondary" className="text-xs capitalize">
                                    {muscle}
                                </Badge>
                            ))}
                            {exercise.primaryMuscles.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                    +{exercise.primaryMuscles.length - 2} more
                                </Badge>
                            )}
                        </span>
                    </CardDescription>
                </CardHeader>
            </Card>
        </Link>
    )
}
