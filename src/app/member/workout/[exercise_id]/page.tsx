import { getExercise } from '@/action/exercise.2.action'
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Dumbbell, ArrowRight, Clock, Target, Users, Award, ChevronRight } from 'lucide-react'


type Props = {
    params: any
}

const ExercisePage = ({
    params
}: Props) => {
    const unwrappedParams = React.use(params)
    const { exercise_id } = unwrappedParams as { exercise_id: string }

    // In a real implementation, this would fetch the exercise data
    // For demonstration purposes, we'll use the sample data
        const exercise = (getExercise(exercise_id));


    if (exercise) {

        return (
            <div className="container mx-auto py-8 px-4">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">{exercise.name}</h1>
                    <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 capitalize">
                            {exercise.category}
                        </Badge>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 capitalize">
                            {exercise.level}
                        </Badge>
                        {exercise.force && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 capitalize">
                                {exercise.force} force
                            </Badge>
                        )}
                    </div>
                </div>
    
                {/* Image Gallery */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {exercise.images.map((image, index) => (
                        <Card key={index} className="overflow-hidden p-0">
                            <div className="relative aspect-video flex items-center justify-center">
                                <img
                                    src={`/exercises/${image}`}
                                    alt={`${exercise.name} - Position ${index + 1}`}
                                    className="object-contain w-full h-full"
                                />
                                <Badge className="absolute bottom-2 right-2 bg-black/70">
                                    {/* {index === 0 ? "Starting position" : "Ending position"} */}
                                    {index + 1}
                                </Badge>
                            </div>
                        </Card>
                    ))}
                </div>
    
                {/* Main Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Left Column - Basic Info */}
                    <Card className="col-span-1">
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Dumbbell className="mr-2 h-5 w-5" />
                                Equipment & Mechanics
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Equipment</p>
                                <p className="text-base capitalize">{exercise.equipment}</p>
                            </div>
    
                            {exercise.mechanic && (
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Mechanic</p>
                                    <p className="text-base capitalize">{exercise.mechanic}</p>
                                </div>
                            )}
    
                            <div>
                                <p className="text-sm font-medium text-gray-500">Difficulty</p>
                                <div className="flex items-center mt-1">
                                    <Award className="h-5 w-5 text-amber-500 mr-1" />
                                    <span className='capitalize'>{exercise.level}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
    
                    {/* Middle Column - Targeted Muscles */}
                    <Card className="col-span-1">
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Target className="mr-2 h-5 w-5" />
                                Targeted Muscles
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Primary Muscles</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {exercise.primaryMuscles.map((muscle, index) => (
                                        <Badge key={index} className="bg-red-100 hover:bg-red-200 text-red-800 border-none capitalize">
                                            {muscle}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
    
                            <div>
                                <p className="text-sm font-medium text-gray-500">Secondary Muscles</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {exercise.secondaryMuscles.length > 0 ? (
                                        exercise.secondaryMuscles.map((muscle, index) => (
                                            <Badge key={index} className="bg-orange-100 hover:bg-orange-200 text-orange-800 border-none capitalize">
                                                {muscle}
                                            </Badge>
                                        ))
                                    ) : (
                                        <span className="text-gray-500">None</span>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
    
                    {/* Right Column - Quick Summary */}
                    <Card className="col-span-1">
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Clock className="mr-2 h-5 w-5" />
                                Exercise Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Type</p>
                                <p className="text-base capitalize">{exercise.category}</p>
                            </div>
    
                            <div>
                                <p className="text-sm font-medium text-gray-500">Recommended For</p>
                                <p className="text-base">
                                    {exercise.level === "beginner" ? "All fitness levels (Beginners)" :
                                        exercise.level === "intermediate" ? "Regular gym-goers (Intermediates)" :
                                            "Experienced athletes (hard)"}
                                </p>
                            </div>
    
                            <div>
                                <p className="text-sm font-medium text-gray-500">Suggested Reps</p>
                                <p className="text-base">10-20 repetitions per leg</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
    
                {/* Instructions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <CheckCircle2 className="mr-2 h-5 w-5" />
                            How to Perform {exercise.name}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ol className="space-y-4">
                            {exercise.instructions.map((instruction, index) => (
                                <li key={index} className="flex">
                                    <div className="flex-shrink-0 mr-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                                            {index + 1}
                                        </div>
                                    </div>
                                    <div className="pt-1">
                                        <p>{instruction}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>
    
                {/* Tips Section */}
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Users className="mr-2 h-5 w-5" />
                            Pro Tips
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2">
                            <li className="flex items-start">
                                <ChevronRight className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                                <span>Keep your movements slow and controlled for maximum hamstring engagement.</span>
                            </li>
                            <li className="flex items-start">
                                <ChevronRight className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                                <span>Don't force the stretch beyond your comfort zone.</span>
                            </li>
                            <li className="flex items-start">
                                <ChevronRight className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                                <span>Focus on maintaining proper form rather than increasing repetitions.</span>
                            </li>
                            <li className="flex items-start">
                                <ChevronRight className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                                <span>If you experience pain (not just stretching tension), stop immediately.</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        )
    }
}

export default ExercisePage