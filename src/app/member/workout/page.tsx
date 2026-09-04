import { getExercises } from '@/action/exercise.2.action'
import { GetAllExercise } from '@/action/exercise.action'
import WorkoutsList from '@/components/WorkoutsList'
import React from 'react'


const page = async () => {

  return (
    <div>
        <WorkoutsList AllExercise={getExercises()}/>
    </div>
  )
}

export default page