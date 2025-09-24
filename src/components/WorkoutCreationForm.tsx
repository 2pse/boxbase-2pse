import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { EXERCISES, ExerciseItem } from "@/data/exercises"

interface WorkoutCreationFormProps {
  userNickname: string
  onBack: () => void
  onWorkoutCreated: () => void
}

export const WorkoutCreationForm = ({ userNickname, onBack, onWorkoutCreated }: WorkoutCreationFormProps) => {
  const [workoutType, setWorkoutType] = useState<"WOD" | "Weightlifting">("WOD")
  const [title, setTitle] = useState("")
  const [workoutContent, setWorkoutContent] = useState("")
  const [notes, setNotes] = useState("")
  const [scalingBeginner, setScalingBeginner] = useState("")
  const [scalingScaled, setScalingScaled] = useState("")
  const [scalingRx, setScalingRx] = useState("")
  const [selectedExercises, setSelectedExercises] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  

  const groupedExercises = EXERCISES.reduce((acc, exercise) => {
    if (!acc[exercise.category]) {
      acc[exercise.category] = []
    }
    acc[exercise.category].push(exercise)
    return acc
  }, {} as Record<string, ExerciseItem[]>)

  const toggleExercise = (exerciseName: string) => {
    setSelectedExercises(prev => 
      prev.includes(exerciseName)
        ? prev.filter(e => e !== exerciseName)
        : [...prev, exerciseName]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim() || !workoutContent.trim()) {
      toast.error("Bitte fülle mindestens Titel und Workout aus.")
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('crossfit_workouts')
        .insert({
          title: title.trim(),
          workout_type: workoutType,
          author_nickname: userNickname,
          workout_content: workoutContent.trim(),
          notes: notes.trim() || null,
          scaling_beginner: scalingBeginner.trim() || null,
          scaling_scaled: scalingScaled.trim() || null,
          scaling_rx: scalingRx.trim() || null,
          required_exercises: selectedExercises
        })

      if (error) throw error

      toast.success("Workout erfolgreich erstellt!")
      onWorkoutCreated()
    } catch (error) {
      console.error('Error creating workout:', error)
      toast.error("Fehler beim Erstellen des Workouts.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            Neues WOD erstellen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Workout Type */}
            <div>
              <Label>Workout Type</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={workoutType === "WOD" ? "default" : "outline"}
                  onClick={() => setWorkoutType("WOD")}
                >
                  WOD
                </Button>
                <Button
                  type="button"
                  variant={workoutType === "Weightlifting" ? "default" : "outline"}
                  onClick={() => setWorkoutType("Weightlifting")}
                >
                  Weightlifting
                </Button>
              </div>
            </div>

            {/* Title */}
            <div>
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Fran, Grace, Deadlift 5RM..."
              />
            </div>

            {/* Author (readonly) */}
            <div>
              <Label>Autor</Label>
              <Input value={userNickname} disabled />
            </div>

            {/* Workout Content */}
            <div>
              <Label htmlFor="workout">Workout</Label>
              <Textarea
                id="workout"
                value={workoutContent}
                onChange={(e) => setWorkoutContent(e.target.value)}
                placeholder="Beschreibe das Workout..."
                rows={6}
              />
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Zusätzliche Hinweise..."
                rows={3}
              />
            </div>

            {/* Scaling Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="beginner">Beginner</Label>
                <Textarea
                  id="beginner"
                  value={scalingBeginner}
                  onChange={(e) => setScalingBeginner(e.target.value)}
                  placeholder="Beginner Scaling..."
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="scaled">Scaled</Label>
                <Textarea
                  id="scaled"
                  value={scalingScaled}
                  onChange={(e) => setScalingScaled(e.target.value)}
                  placeholder="Scaled Scaling..."
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="rx">RX</Label>
                <Textarea
                  id="rx"
                  value={scalingRx}
                  onChange={(e) => setScalingRx(e.target.value)}
                  placeholder="RX Scaling..."
                  rows={4}
                />
              </div>
            </div>

            {/* Exercise Selection */}
            <div>
              <Label>Verwendete Übungen</Label>
              <div className="mt-2 space-y-4">
                {Object.entries(groupedExercises).map(([category, exercises]) => (
                  <div key={category}>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">{category}</h4>
                    <div className="flex flex-wrap gap-2">
                      {exercises.map((exercise) => (
                        <Badge
                          key={exercise.name}
                          variant={selectedExercises.includes(exercise.name) ? "default" : "secondary"}
                          className="cursor-pointer hover:bg-primary/20"
                          onClick={() => toggleExercise(exercise.name)}
                        >
                          {exercise.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                <Plus className="h-4 w-4 mr-2" />
                {isSubmitting ? "Erstelle..." : "Workout erstellen"}
              </Button>
              <Button type="button" variant="outline" onClick={onBack}>
                Abbrechen
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}