import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useNavigate } from "react-router-dom"
import { WorkoutTypeSelector, WorkoutType } from "./WorkoutTypeSelector"
import { CrossfitTypeSelector, CrossfitType } from "./CrossfitTypeSelector"
import { BodybuildingSelector, BodybuildingFocus, BodybuildingDifficulty } from "./BodybuildingSelector"
import { WorkoutDisplay } from "./WorkoutDisplay"
import { WorkoutCreationForm } from "./WorkoutCreationForm"
import { PercentageCalculator } from "./PercentageCalculator"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { User } from "@supabase/supabase-js"
import { Plus, Dumbbell, ArrowLeft, Clock, Calculator } from "lucide-react"

interface WorkoutGeneratorProps {
  user?: User | null
  wodStep?: number
  onStepChange?: (step: number) => void
}

interface CrossfitWorkout {
  id: string
  title: string
  workout_type: string
  author_nickname: string
  workout_content: string
  notes?: string
  scaling_beginner?: string
  scaling_scaled?: string
  scaling_rx?: string
  required_exercises?: string[]
}

interface BodybuildingWorkout {
  id: string
  title: string
  focus_area: string
  difficulty: string
  workout_content: string
  notes?: string
}

export const WorkoutGenerator = ({ user, wodStep: externalStep, onStepChange }: WorkoutGeneratorProps) => {
  const navigate = useNavigate()
  const [step, setStep] = useState(externalStep || 1)
  const [workoutType, setWorkoutType] = useState<WorkoutType>(null)
  const [crossfitType, setCrossfitType] = useState<CrossfitType>(null)
  const [bodybuilding, setBodybuilding] = useState<{
    focus: BodybuildingFocus
    difficulty: BodybuildingDifficulty
  }>({ focus: null, difficulty: null })
  
  const [generatedWorkout, setGeneratedWorkout] = useState<CrossfitWorkout | BodybuildingWorkout | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showCreationForm, setShowCreationForm] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [showPercentageCalculator, setShowPercentageCalculator] = useState(false)

  useEffect(() => {
    if (user) {
      loadUserProfile()
    }
  }, [user])

  const loadUserProfile = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      setUserProfile(data)
    } catch (error) {
      console.error('Error loading user profile:', error)
    }
  }

  const generateWorkout = async () => {
    setIsGenerating(true)

    try {
      if (workoutType === "crossfit" && crossfitType) {
        await generateCrossfitWorkout()
      } else if (workoutType === "bodybuilding" && bodybuilding.focus && bodybuilding.difficulty) {
        await generateBodybuildingWorkout()
      }
    } catch (error) {
      console.error('Error generating workout:', error)
      toast.error("Fehler beim Generieren des Workouts")
    } finally {
      setIsGenerating(false)
    }
  }

  const generateCrossfitWorkout = async () => {
    if (!crossfitType) return

    try {
      let query = supabase
        .from('crossfit_workouts')
        .select('*')
        .eq('workout_type', crossfitType)

      const { data, error } = await query

      if (error) throw error

      if (!data || data.length === 0) {
        toast.error("Keine passenden Workouts gefunden.")
        return
      }

      // Filter by user's preferred exercises if it's a WOD (done in JavaScript to avoid JSONB issues)
      let filteredWorkouts = data
      if (crossfitType === "WOD" && userProfile?.preferred_exercises && userProfile.preferred_exercises.length > 0) {
        filteredWorkouts = data.filter(workout => {
          const requiredExercises = workout.required_exercises
          // Check if ALL required exercises are in user's preferred exercises
          if (Array.isArray(requiredExercises)) {
            return requiredExercises.every((exercise: any) => 
              typeof exercise === 'string' && userProfile.preferred_exercises.includes(exercise)
            )
          }
          return false
        })
        
        // If no workouts match preferences, use all available workouts
        if (filteredWorkouts.length === 0) {
          filteredWorkouts = data
          toast.info("Keine Workouts mit deinen bevorzugten Übungen gefunden. Zeige alle verfügbaren WODs.")
        }
      }

      // Select random workout from filtered results
      const randomWorkout = filteredWorkouts[Math.floor(Math.random() * filteredWorkouts.length)]
      // Convert the database result to our interface
      const convertedWorkout: CrossfitWorkout = {
        ...randomWorkout,
        required_exercises: Array.isArray(randomWorkout.required_exercises) 
          ? randomWorkout.required_exercises.filter((ex): ex is string => typeof ex === 'string')
          : []
      }
      setGeneratedWorkout(convertedWorkout)
    } catch (error) {
      throw error
    }
  }

  const generateBodybuildingWorkout = async () => {
    if (!bodybuilding.focus || !bodybuilding.difficulty) return

    try {
      const { data, error } = await supabase
        .from('bodybuilding_workouts')
        .select('*')
        .eq('focus_area', bodybuilding.focus)
        .eq('difficulty', bodybuilding.difficulty)

      if (error) throw error

      if (!data || data.length === 0) {
        toast.error("Keine passenden Workouts gefunden.")
        return
      }

      // Select random workout
      const randomWorkout = data[Math.floor(Math.random() * data.length)]
      setGeneratedWorkout(randomWorkout as BodybuildingWorkout)
    } catch (error) {
      throw error
    }
  }

  const newWorkout = async () => {
    setIsGenerating(true)
    try {
      if (workoutType === "crossfit" && crossfitType) {
        await generateCrossfitWorkout()
      } else if (workoutType === "bodybuilding" && bodybuilding.focus && bodybuilding.difficulty) {
        await generateBodybuildingWorkout()
      }
    } catch (error) {
      console.error('Error generating new workout:', error)
      toast.error("Fehler beim Generieren des neuen Workouts")
    } finally {
      setIsGenerating(false)
    }
  }

  const resetSelection = () => {
    const newStep = 1
    setStep(newStep)
    setWorkoutType(null)
    setCrossfitType(null)
    setBodybuilding({ focus: null, difficulty: null })
    setGeneratedWorkout(null)
    setShowCreationForm(false)
    onStepChange?.(newStep)
  }

  const handleWorkoutTypeSelect = (type: WorkoutType) => {
    setWorkoutType(type)
    const newStep = 2
    setStep(newStep)
    onStepChange?.(newStep)
  }

  const handleCrossfitTypeSelect = (type: CrossfitType) => {
    setCrossfitType(type)
    const newStep = 3
    setStep(newStep)
    onStepChange?.(newStep)
  }

  const handleBodybuildingFocusSelect = (focus: BodybuildingFocus) => {
    setBodybuilding(prev => ({ ...prev, focus }))
    const newStep = 3
    setStep(newStep)
    onStepChange?.(newStep)
  }

  const handleBodybuildingDifficultySelect = (difficulty: BodybuildingDifficulty) => {
    setBodybuilding(prev => ({ ...prev, difficulty }))
    const newStep = 4
    setStep(newStep)
    onStepChange?.(newStep)
  }

  const goBack = () => {
    let newStep = step
    if (step === 2) {
      newStep = 1
      setStep(newStep)
      setWorkoutType(null)
      setCrossfitType(null)
      setBodybuilding({ focus: null, difficulty: null })
    } else if (step === 3) {
      newStep = 2
      setStep(newStep)
      if (workoutType === "crossfit") {
        setCrossfitType(null)
      } else if (workoutType === "bodybuilding") {
        setBodybuilding(prev => ({ ...prev, focus: null }))
      }
    } else if (step === 4) {
      newStep = 3
      setStep(newStep)
      setBodybuilding(prev => ({ ...prev, difficulty: null }))
    }
    onStepChange?.(newStep)
  }

  const canGenerate = () => {
    if (workoutType === "crossfit") {
      return crossfitType !== null
    }
    if (workoutType === "bodybuilding") {
      return bodybuilding.focus !== null && bodybuilding.difficulty !== null
    }
    return false
  }

  const isAuthor = userProfile?.authors === true

  // Show percentage calculator
  if (showPercentageCalculator && user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="px-4 pt-4 pb-2">
          <Button variant="ghost" onClick={() => setShowPercentageCalculator(false)} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
        </div>
        <div className="text-center py-6">
          <h1 className="text-3xl font-bold text-foreground">Prozentrechner</h1>
        </div>
        <PercentageCalculator user={user} />
      </div>
    )
  }

  // Show creation form
  if (showCreationForm && isAuthor) {
    return (
      <WorkoutCreationForm 
        userNickname={userProfile?.display_name || userProfile?.nickname || 'Unbekannt'}
        onBack={() => setShowCreationForm(false)}
        onWorkoutCreated={() => {
          setShowCreationForm(false)
          toast.success("Workout erfolgreich erstellt!")
        }}
      />
    )
  }

  // Show workout display
  if (generatedWorkout) {
    return (
      <WorkoutDisplay 
        workout={generatedWorkout}
        workoutType={workoutType!}
        onNewWorkout={newWorkout}
        onReset={resetSelection}
        isGenerating={isGenerating}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Back button top-left - only show on sub-pages, not on main selection */}
      {step > 1 && (
        <div className="px-4 pt-4 pb-2">
          <Button variant="ghost" onClick={goBack} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
        </div>
      )}
      
        <div className="text-center py-6">
          <h1 className="text-3xl font-bold text-foreground">Workout</h1>
        </div>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Step 1: Workout Type Selection */}
          {step === 1 && (
            <div>
              <WorkoutTypeSelector 
                selectedType={workoutType}
                onTypeSelect={handleWorkoutTypeSelect}
              />
              
              {/* Timer Button */}
              <div className="mt-4 px-4">
                <div 
                  className="bg-gray-100 dark:bg-gray-800 cursor-pointer hover:bg-gray-150 dark:hover:bg-gray-700 transition-all hover:scale-105 rounded-2xl h-32 shadow-sm p-6"
                  onClick={() => {
                    // Set referrer to WOD page for proper back navigation
                    sessionStorage.setItem('timer-referrer', '/pro?tab=wod')
                    navigate('/workout-timer')
                  }}
                >
                  <div className="text-center space-y-3 flex flex-col justify-center h-full">
                    <h3 className="text-xl font-bold">Workout-Timer</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Timer for your workouts
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Percentage Calculator Button */}
              <div className="mt-4 px-4">
                <div 
                  className="bg-gray-100 dark:bg-gray-800 cursor-pointer hover:bg-gray-150 dark:hover:bg-gray-700 transition-all hover:scale-105 rounded-2xl h-32 shadow-sm p-6"
                  onClick={() => setShowPercentageCalculator(true)}
                >
                  <div className="text-center space-y-3 flex flex-col justify-center h-full">
                    <h3 className="text-xl font-bold">Prozentrechner</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Calculate your<br />
                      training weights
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: CrossFit Type Selection */}
          {step === 2 && workoutType === "crossfit" && (
            <div className="space-y-6">
              <CrossfitTypeSelector
                selectedType={crossfitType}
                onTypeSelect={handleCrossfitTypeSelect}
              />
              
              {/* "Workout hinzufügen" Button for Authors */}
              {isAuthor && (
                <div className="px-4 pt-4">
                  <Button 
                    onClick={() => setShowCreationForm(true)}
                    variant="outline"
                    className="w-full rounded-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Workout hinzufügen
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Bodybuilding Focus Selection */}
          {step === 2 && workoutType === "bodybuilding" && (
            <div className="space-y-6">
              <BodybuildingSelector
                selectedFocus={bodybuilding.focus}
                selectedDifficulty={null}
                onFocusSelect={handleBodybuildingFocusSelect}
                onDifficultySelect={() => {}}
              />
            </div>
          )}

          {/* Step 3: Bodybuilding Difficulty Selection */}
          {step === 3 && workoutType === "bodybuilding" && (
            <div className="space-y-6">
              <BodybuildingSelector
                selectedFocus={bodybuilding.focus}
                selectedDifficulty={bodybuilding.difficulty}
                onFocusSelect={() => {}}
                onDifficultySelect={handleBodybuildingDifficultySelect}
              />
            </div>
          )}

          {/* Step 3: CrossFit Generate Workout */}
          {step === 3 && workoutType === "crossfit" && (
            <div className="space-y-6">
              <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-2xl mx-4">
                <h4 className="font-semibold mb-2">Deine Auswahl:</h4>
                <p className="text-muted-foreground">Functional Fitness - {crossfitType}</p>
              </div>

              <div className="px-4">
                <Button 
                  onClick={generateWorkout}
                  disabled={isGenerating}
                  size="lg"
                  className="w-full h-16 text-lg font-semibold rounded-2xl shadow-lg"
                >
                  <Dumbbell className="h-6 w-6 mr-3" />
                  {isGenerating ? "Generiere..." : "Workout generieren"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Bodybuilding Generate Workout */}
          {step === 4 && workoutType === "bodybuilding" && (
            <div className="space-y-6">
              <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-2xl mx-4">
                <h4 className="font-semibold mb-2">Deine Auswahl:</h4>
                <p className="text-muted-foreground">Bodybuilding - {bodybuilding.focus} ({bodybuilding.difficulty})</p>
              </div>

              <div className="px-4">
                <Button 
                  onClick={generateWorkout}
                  disabled={isGenerating}
                  size="lg"
                  className="w-full h-16 text-lg font-semibold rounded-2xl shadow-lg"
                >
                  <Dumbbell className="h-6 w-6 mr-3" />
                  {isGenerating ? "Generiere..." : "Workout generieren"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}