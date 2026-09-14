'use client'

import React, { useState, useEffect } from 'react'
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { ACTIVITY_LEVELS, mifflinStJeor } from "@/lib/nutrition"

const BMRCalculator: React.FC = () => {
  // Initial state values
  const [weight, setWeight] = useState<number>(70)
  const [height, setHeight] = useState<number>(170)
  const [age, setAge] = useState<number>(30)
  const [gender, setGender] = useState<string>("male")
  const [bmr, setBMR] = useState<number>(0)
  
  // Activity multipliers for TDEE. Shared with the member nutrition feature,
  // so the admin tool and a member's targets can never disagree.
  const activityLevels = ACTIVITY_LEVELS

  // Calculate BMR whenever inputs change
  useEffect(() => {
    calculateBMR()
  }, [weight, height, age, gender])

  // Mifflin-St Jeor, from the shared module
  const calculateBMR = () => {
    setBMR(Math.round(mifflinStJeor(weight, height, age, gender === "male" ? "male" : "female")))
  }

  return (
    <div className="space-y-6">
      {/* Gender selection */}
      <div className="space-y-2">
        <Label>Gender</Label>
        <RadioGroup
          defaultValue="male"
          value={gender}
          onValueChange={setGender}
          className="flex space-x-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="male" id="male" />
            <Label htmlFor="male">Male</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="female" id="female" />
            <Label htmlFor="female">Female</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Weight slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="weight">Weight</Label>
          <span className="text-sm font-medium">{weight} kg</span>
        </div>
        <Slider 
          id="weight"
          min={30}
          max={200}
          step={1}
          value={[weight]}
          onValueChange={(value) => setWeight(value[0])}
          className="py-4"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>30 kg</span>
          <span>200 kg</span>
        </div>
      </div>

      {/* Height slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="height">Height</Label>
          <span className="text-sm font-medium">{height} cm</span>
        </div>
        <Slider 
          id="height"
          min={120}
          max={220}
          step={1}
          value={[height]}
          onValueChange={(value) => setHeight(value[0])}
          className="py-4"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>120 cm</span>
          <span>220 cm</span>
        </div>
      </div>

      {/* Age slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="age">Age</Label>
          <span className="text-sm font-medium">{age} years</span>
        </div>
        <Slider 
          id="age"
          min={18}
          max={100}
          step={1}
          value={[age]}
          onValueChange={(value) => setAge(value[0])}
          className="py-4"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>18 years</span>
          <span>100 years</span>
        </div>
      </div>

      {/* Result section */}
      <div className="pt-4">
        <div className="text-center mb-6">
          <div className="text-sm text-muted-foreground mb-1">Your Basal Metabolic Rate</div>
          <div className="text-4xl font-bold">{bmr} <span className="text-base text-muted-foreground">kcal/day</span></div>
          <p className="text-xs text-muted-foreground mt-2">
            This is the number of calories your body needs to maintain basic functions at rest
          </p>
        </div>

        {/* TDEE Estimations */}
        <div className="space-y-4 mt-6">
          <Label className="font-medium">Estimated daily calorie needs</Label>
          
          {activityLevels.map((level, index) => {
            const tdee = Math.round(bmr * level.factor)
            // Calculate percentage for visual indicator (scale between 1500-4000)
            const percentage = Math.min(100, Math.max(0, ((tdee - 1500) / 2500) * 100))
            
            return (
              <div key={index} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{level.label}</span>
                  <span className="font-medium">{tdee} kcal</span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            )
          })}
        </div>
        
        {/* Information alert */}
        <Alert className="mt-6 bg-muted/50">
          <InfoIcon className="h-4 w-4" />
          <AlertDescription className="text-xs text-muted-foreground">
            BMR calculated using the Mifflin-St Jeor formula: 
            Men: BMR = 10×weight(kg) + 6.25×height(cm) - 5×age + 5
            Women: BMR = 10×weight(kg) + 6.25×height(cm) - 5×age - 161
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}

export default BMRCalculator