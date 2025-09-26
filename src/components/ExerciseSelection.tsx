import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useNavigate } from "react-router-dom"
import { useToast } from "@/hooks/use-toast"

const EXERCISES = [
  // Barbell
  { category: "Barbell", name: "Back Squat" },
  { category: "Barbell", name: "Front Squat" },
  { category: "Barbell", name: "Overhead Squat" },
  { category: "Barbell", name: "Deadlift" },
  { category: "Barbell", name: "Bench Press" },
  { category: "Barbell", name: "Strict Press" },
  { category: "Barbell", name: "Push Press" },
  { category: "Barbell", name: "Push Jerk" },
  { category: "Barbell", name: "Split Jerk" },
  { category: "Barbell", name: "Thruster" },

  // Olympic Lifts
  { category: "Olympic Lifts", name: "Power Snatch" },
  { category: "Olympic Lifts", name: "Squat Snatch" },
  { category: "Olympic Lifts", name: "Power Clean" },
  { category: "Olympic Lifts", name: "Squat Clean" },
  { category: "Olympic Lifts", name: "Clean & Jerk" },

  // Gymnastics – Pull
  { category: "Gymnastics – Pull", name: "Strict Pull-Up" },
  { category: "Gymnastics – Pull", name: "Kipping Pull-Up" },
  { category: "Gymnastics – Pull", name: "Butterfly Pull-Up" },
  { category: "Gymnastics – Pull", name: "Chest-to-Bar Pull-Up" },
  { category: "Gymnastics – Pull", name: "Bar Muscle-Up" },
  { category: "Gymnastics – Pull", name: "Ring Muscle-Up" },
  { category: "Gymnastics – Pull", name: "Rope Climb" },

  // Gymnastics – Push
  { category: "Gymnastics – Push", name: "Handstand Push-Up" },
  { category: "Gymnastics – Push", name: "Handstand Walk" },
  { category: "Gymnastics – Push", name: "Ring Dip" },
  { category: "Gymnastics – Push", name: "Wall Walks" },
  { category: "Gymnastics – Push", name: "Push Ups" },

  // Gymnastics – Core
  { category: "Gymnastics – Core", name: "Toes-to-Bar" },
  { category: "Gymnastics – Core", name: "Knees-to-Elbows" },
  { category: "Gymnastics – Core", name: "GHD Sit-Up" },
  { category: "Gymnastics – Core", name: "V-Ups" },
  { category: "Gymnastics – Core", name: "Hollow Rock" },
  { category: "Gymnastics – Core", name: "L-Sit" },
  { category: "Gymnastics – Core", name: "Plank" },
  { category: "Gymnastics – Core", name: "Sit Ups" },

  // Lower Body
  { category: "Lower Body", name: "Pistol Squat" },
  { category: "Lower Body", name: "Lunges" },
  { category: "Lower Body", name: "Overhead Lunges" },
  { category: "Lower Body", name: "Box Step-Ups" },
  { category: "Lower Body", name: "Bulgarian Split Squat" },
  { category: "Lower Body", name: "Air Squats" },

  // Cardio
  { category: "Cardio", name: "Run" },
  { category: "Cardio", name: "Row" },
  { category: "Cardio", name: "SkiErg" },
  { category: "Cardio", name: "BikeErg" },
  { category: "Cardio", name: "Assault Bike" },
  { category: "Cardio", name: "Double Unders" },
  { category: "Cardio", name: "Single Unders" },
  { category: "Cardio", name: "Box Jump" },
  { category: "Cardio", name: "Box Jump Over" },
  { category: "Cardio", name: "Burpee" },
  { category: "Cardio", name: "Burpee Box Jump Over" },
  { category: "Cardio", name: "Burpee Box Jump Overs" },

  // Dumbbell Movements
  { category: "Dumbbell Movements", name: "DB Snatch" },
  { category: "Dumbbell Movements", name: "DB Clean" },
  { category: "Dumbbell Movements", name: "DB Clean & Jerk" },
  { category: "Dumbbell Movements", name: "DB Thruster" },
  { category: "Dumbbell Movements", name: "DB Push Press" },
  { category: "Dumbbell Movements", name: "DB Lunges" },
  { category: "Dumbbell Movements", name: "DB Bench Press" },
  { category: "Dumbbell Movements", name: "DB Row" },
  { category: "Dumbbell Movements", name: "DB Devil Press" },
  { category: "Dumbbell Movements", name: "DB Overhead Squat" },

  // Kettlebell Movements
  { category: "Kettlebell Movements", name: "KB Swing" },
  { category: "Kettlebell Movements", name: "KB Snatch" },
  { category: "Kettlebell Movements", name: "KB Clean & Jerk" },
  { category: "Kettlebell Movements", name: "KB Goblet Squat" },
  { category: "Kettlebell Movements", name: "KB Lunges" },
  { category: "Kettlebell Movements", name: "KB Turkish Get-Up" },

  // Other
  { category: "Other", name: "Wall Ball" },
  { category: "Other", name: "Sandbag Clean" },
  { category: "Other", name: "Sandbag Carry" },
  { category: "Other", name: "Farmer's Carry" },
  { category: "Other", name: "Sled Push" },
  { category: "Other", name: "Sled Pull" },
  { category: "Other", name: "D-Ball Over Shoulder" }
]

type Exercise = typeof EXERCISES[number]

export const ExerciseSelection = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  
  const handleBack = () => {
    navigate('/pro?openProfile=true')
  }
  
  // By default all exercises are selected (green)
  const [selectedExercises, setSelectedExercises] = useState<string[]>(
    EXERCISES.map(ex => ex.name)
  )

  useEffect(() => {
    loadExercisePreferences()
  }, [])

  const loadExercisePreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('preferred_exercises')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profile) {
        const preferences = profile.preferred_exercises as string[]
        // If preferences is null, undefined, or empty array, default to all exercises
        if (!preferences || preferences.length === 0) {
          setSelectedExercises(EXERCISES.map(ex => ex.name))
        } else {
          setSelectedExercises(preferences)
        }
      }
    } catch (error) {
      console.error('Error loading exercise preferences:', error)
    }
  }

  const saveExercisePreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('profiles')
        .update({
          preferred_exercises: selectedExercises
        })
        .eq('user_id', user.id)

      if (error) throw error

      toast({
        title: "Exercises saved",
        description: "Your exercise preferences have been successfully saved."
      })
    } catch (error) {
      console.error('Error saving exercise preferences:', error)
      toast({
        title: "Error",
        description: "Exercise preferences could not be saved.",
        variant: "destructive"
      })
    }
  }

  const toggleExercise = (exerciseName: string) => {
    setSelectedExercises(prev => 
      prev.includes(exerciseName)
        ? prev.filter(name => name !== exerciseName)
        : [...prev, exerciseName]
    )
  }

  const groupedExercises = useMemo(() => {
    return EXERCISES.reduce((acc, exercise) => {
      if (!acc[exercise.category]) {
        acc[exercise.category] = []
      }
      acc[exercise.category].push(exercise)
      return acc
    }, {} as Record<string, Exercise[]>)
  }, [])

  return (
    <div
      className="min-h-screen bg-background overflow-y-auto"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 4rem)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Exercise Preferences</h1>
          </div>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Preferred Exercises</CardTitle>
            <p className="text-sm text-muted-foreground">
              Green exercises will be preferred in your workouts. Click on an exercise to deactivate it.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(groupedExercises).map(([category, exercises]) => (
              <div key={category} className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  {category}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {exercises.map((exercise) => (
                    <Badge
                      key={exercise.name}
                      variant={selectedExercises.includes(exercise.name) ? "default" : "secondary"}
                      className={`cursor-pointer hover:opacity-80 transition-colors ${
                        selectedExercises.includes(exercise.name) 
                          ? "bg-green-600 hover:bg-green-700 text-white" 
                          : "bg-gray-300 hover:bg-gray-400 text-gray-700"
                      }`}
                      onClick={() => toggleExercise(exercise.name)}
                    >
                      {exercise.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button onClick={saveExercisePreferences} className="w-full">
          Save Exercise Preferences
        </Button>
      </div>
    </div>
  )
}