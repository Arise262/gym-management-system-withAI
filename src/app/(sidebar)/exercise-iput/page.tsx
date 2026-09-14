'use client'
import React from 'react'
import Data from './exercises.json'
import { Button } from '@/components/ui/button'
// import { AddMember } from '@/action/member.action'
import { format, parseISO } from 'date-fns'
import { AddExercise } from '@/action/exercise.action'
import { exercisePhotos } from '@/lib/exercise-photos'
// import { console } from 'inspector'
type Props = {}

const page = (props: Props) => {
    const data = Data
    const handleClick = () => {
        var i = 1
        var j = 1
        data.forEach(async (element) => {
            const res = await AddExercise({
                json_id: element.id,
                name: element.name,
                force: element.force || '',
                level: element.level,
                mechanic: element.mechanic || '',
                equipment: element.equipment || '',
                primaryMuscles: element.primaryMuscles || [],
                secondaryMuscles: element.secondaryMuscles || [],
                instructions: element.instructions,
                category: element.category,
                images: exercisePhotos(element)
            })
            if(res.id){
                console.log(i)
                console.log(res)
                i++
            }
            else{
                console.log(j)
                console.log('Error:', element)
                j++

            }
        });
        // console.log(phoneIssue)
    }
    return (
        <div><Button onClick={handleClick}>Test</Button></div>
    )
}

export default page