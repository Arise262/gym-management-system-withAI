import { getExercises } from '@/action/exercise.2.action'
import WorkoutsList from '@/components/WorkoutsList'

export const metadata = { title: 'Exercise Library' }

const page = () => {
  return <WorkoutsList AllExercise={getExercises()} />
}

export default page
