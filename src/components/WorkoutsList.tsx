'use client'
import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from './ui/badge'
import { Dumbbell, ListFilter, Search } from 'lucide-react'
import { Input } from './ui/input'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Image from 'next/image'

type Exercise = {
    id: string;
    name: string;
    category: string;
    equipment: string;
    level: string;
    images: string[];
    [key: string]: any;
}

type Props = {
    AllExercise: any[]
}

const WorkoutsList = ({ AllExercise }: Props) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');

    // Extract unique categories for tabs
    const categories = [
        "all",
        "powerlifting",
        "strength",
        "stretching",
        "cardio",
        "olympic weightlifting",
        "strongman",
        "plyometrics"
    ];

    // Filter exercises based on search query and active category
    const filteredExercises = useMemo(() => {
        return AllExercise.filter(exercise => {
            // Filter by search query
            const matchesSearch = exercise.name.toLowerCase().includes(searchQuery.toLowerCase());

            // Filter by category
            const matchesCategory = activeCategory === 'all' || exercise.category === activeCategory;

            return matchesSearch && matchesCategory;
        });
    }, [AllExercise, searchQuery, activeCategory]);

    // Handler for search input
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    // Handler for category change
    const handleCategoryChange = (category: string) => {
        setActiveCategory(category);
    };

    return (
        <div className='space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className='flex  items-center gap-2'>
                    <Image src="/logo.png" width={40} height={40} alt="CBG Fitness Center" className='dark:hidden' />
                    <Image src="/logo-light.png" width={40} height={40} alt="CBG Fitness Center" className='hidden dark:block' />
                    <h1 className="text-2xl font-bold tracking-tight">Exercise Library</h1>

                </div>

                {/* Search input with icon */}
                <div className="relative w-full sm:w-1/2 lg:w-1/3">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search exercises..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={handleSearchChange}
                    />
                </div>
            </div>

            {/* Category Tabs */}
            <Tabs defaultValue="all" onValueChange={handleCategoryChange} className="w-full">
                <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 w-full h-auto">
                    {categories.map((category) => (
                        <TabsTrigger
                            key={category}
                            value={category}
                            className="capitalize text-sm py-2"
                        >
                            {category === "all" ? "All Exercises" : category}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* Content for all tabs */}
                <TabsContent value={activeCategory} className="mt-6">
                    {filteredExercises.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <ListFilter className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium">No exercises found</h3>
                            <p className="text-muted-foreground mt-2">
                                Try adjusting your search or filter to find what you're looking for.
                            </p>
                        </div>
                    ) : (
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                            {filteredExercises.map((exercise) => ExerciseCard(exercise))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Results counter */}
            <div className="text-sm text-muted-foreground">
                Showing {filteredExercises.length} {filteredExercises.length === 1 ? 'exercise' : 'exercises'}
                {activeCategory !== 'all' && ` in ${activeCategory}`}
                {searchQuery && ` matching "${searchQuery}"`}
            </div>
        </div>
    )
}

export default WorkoutsList

const ExerciseCard = (exercise: Exercise) => {


    return (
        <Link href={`/user/workout/${exercise.id}`} key={exercise.id}>
            <Card className="overflow-hidden transition-all hover:shadow-lg w-full h-full flex flex-col pt-0">
                <div className="relative h-48 w-full overflow-hidden">
                    <Image
                        src={`/exercises/${exercise.images[0]}`}
                        width={600}
                        height={200}
                        alt={exercise.name}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105 rounded-t-md"
                        onError={(e) => {
                            // Fallback if image fails to load
                            (e.target as HTMLImageElement).src = "https://placehold.co/600x400?text=Exercise";
                        }}
                    />
                    <Badge className="absolute top-2 right-2 hover:bg-primary capitalize">{exercise.level}</Badge>
                </div>
                <CardHeader className="pb-2 flex-1">
                    <CardTitle className="text-lg font-bold line-clamp-2">{exercise.name}</CardTitle>
                    <CardDescription className="flex flex-wrap gap-2 text-sm text-muted-foreground mt-2">
                        <div className="flex items-center text-sm">
                            <ListFilter className="mr-1 h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground capitalize">{exercise.category}</span>
                        </div>
                        <div className="flex items-center text-sm">
                            <Dumbbell className="mr-1 h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground capitalize">{exercise.equipment}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {exercise.primaryMuscles && exercise.primaryMuscles.slice(0, 2).map((muscle: string, index: number) => (
                                <Badge key={index} variant="outline" className=" capitalize text-xs bg-red-50 text-red-700 border-red-200">
                                    {muscle}
                                </Badge>
                            ))}
                            {exercise.primaryMuscles && exercise.primaryMuscles.length > 2 && (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                    +{exercise.primaryMuscles.length - 2} more
                                </Badge>
                            )}
                        </div>
                    </CardDescription>
                </CardHeader>
                {/* Primary muscles badges */}
                {/* <CardFooter className="pt-0 pb-4">
          
        </CardFooter> */}
            </Card>
        </Link>
    )
}