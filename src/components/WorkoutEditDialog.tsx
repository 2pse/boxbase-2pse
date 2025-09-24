import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Edit2, Save, X } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { EXERCISES, ExerciseItem } from "@/data/exercises"

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
  created_at: string
}

interface BodybuildingWorkout {
  id: string
  title: string
  focus_area: string
  difficulty: string
  workout_content: string
  notes?: string
  created_at: string
}

interface WorkoutEditDialogProps {
  workout: CrossfitWorkout | BodybuildingWorkout
  workoutType: 'crossfit' | 'bodybuilding'
  onWorkoutUpdated: () => void
}

export const WorkoutEditDialog = ({ workout, workoutType, onWorkoutUpdated }: WorkoutEditDialogProps) => {
  const [open, setOpen] = useState(false)
  const [editedWorkout, setEditedWorkout] = useState<any>(workout)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setEditedWorkout(workout)
  }, [workout])

  const isCrossfitWorkout = (w: any): w is CrossfitWorkout => workoutType === 'crossfit'

  const groupedExercises = EXERCISES.reduce((acc, exercise) => {
    if (!acc[exercise.category]) acc[exercise.category] = []
    acc[exercise.category].push(exercise)
    return acc
  }, {} as Record<string, ExerciseItem[]>)

  const toggleExercise = (name: string) => {
    setEditedWorkout((prev: any) => {
      const current: string[] = Array.isArray(prev.required_exercises) ? prev.required_exercises : []
      const next = current.includes(name)
        ? current.filter((e) => e !== name)
        : [...current, name]
      return { ...prev, required_exercises: next }
    })
  }

  const handleSave = async () => {
    if (!editedWorkout.title || !editedWorkout.workout_content) {
      toast.error("Titel und Workout-Inhalt sind erforderlich")
      return
    }

    setIsSaving(true)
    try {
      if (workoutType === 'crossfit') {
        const { error } = await supabase
          .from('crossfit_workouts')
          .update({
            title: editedWorkout.title,
            workout_type: editedWorkout.workout_type,
            workout_content: editedWorkout.workout_content,
            notes: editedWorkout.notes || null,
            scaling_beginner: editedWorkout.scaling_beginner || null,
            scaling_scaled: editedWorkout.scaling_scaled || null,
            scaling_rx: editedWorkout.scaling_rx || null,
            required_exercises: Array.isArray(editedWorkout.required_exercises) ? editedWorkout.required_exercises : []
          })
          .eq('id', workout.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('bodybuilding_workouts')
          .update({
            title: editedWorkout.title,
            focus_area: editedWorkout.focus_area,
            difficulty: editedWorkout.difficulty,
            workout_content: editedWorkout.workout_content,
            notes: editedWorkout.notes || null
          })
          .eq('id', workout.id)

        if (error) throw error
      }

      toast.success("Workout erfolgreich aktualisiert!")
      setOpen(false)
      onWorkoutUpdated()
    } catch (error) {
      console.error('Error updating workout:', error)
      toast.error("Fehler beim Aktualisieren des Workouts")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Edit2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Workout bearbeiten</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <Label htmlFor="title">Titel</Label>
            <Input
              id="title"
              value={editedWorkout.title}
              onChange={(e) => setEditedWorkout(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>

          {isCrossfitWorkout(editedWorkout) && (
            <div>
              <Label>Workout Type</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={editedWorkout.workout_type === "WOD" ? "default" : "outline"}
                  onClick={() => setEditedWorkout(prev => ({ ...prev, workout_type: "WOD" }))}
                >
                  WOD
                </Button>
                <Button
                  type="button"
                  variant={editedWorkout.workout_type === "Weightlifting" ? "default" : "outline"}
                  onClick={() => setEditedWorkout(prev => ({ ...prev, workout_type: "Weightlifting" }))}
                >
                  Weightlifting
                </Button>
              </div>
            </div>
          )}

          {!isCrossfitWorkout(editedWorkout) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fokusbereich</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {["Ganzkörper", "Oberkörper", "Unterkörper", "Push", "Pull"].map(focus => (
                    <Button
                      key={focus}
                      type="button"
                      size="sm"
                      variant={editedWorkout.focus_area === focus ? "default" : "outline"}
                      onClick={() => setEditedWorkout(prev => ({ ...prev, focus_area: focus }))}
                    >
                      {focus}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Schwierigkeit</Label>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  {["Leicht", "Mittel", "Schwer"].map(difficulty => (
                    <Button
                      key={difficulty}
                      type="button"
                      size="sm"
                      variant={editedWorkout.difficulty === difficulty ? "default" : "outline"}
                      onClick={() => setEditedWorkout(prev => ({ ...prev, difficulty: difficulty }))}
                    >
                      {difficulty}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="content">Workout Inhalt</Label>
            <Textarea
              id="content"
              value={editedWorkout.workout_content}
              onChange={(e) => setEditedWorkout(prev => ({ ...prev, workout_content: e.target.value }))}
              rows={8}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              value={editedWorkout.notes || ""}
              onChange={(e) => setEditedWorkout(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          {isCrossfitWorkout(editedWorkout) && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="beginner">Beginner Scaling</Label>
                  <Textarea
                    id="beginner"
                    value={editedWorkout.scaling_beginner || ""}
                    onChange={(e) => setEditedWorkout(prev => ({ ...prev, scaling_beginner: e.target.value }))}
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="scaled">Scaled Scaling</Label>
                  <Textarea
                    id="scaled"
                    value={editedWorkout.scaling_scaled || ""}
                    onChange={(e) => setEditedWorkout(prev => ({ ...prev, scaling_scaled: e.target.value }))}
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="rx">RX Scaling</Label>
                  <Textarea
                    id="rx"
                    value={editedWorkout.scaling_rx || ""}
                    onChange={(e) => setEditedWorkout(prev => ({ ...prev, scaling_rx: e.target.value }))}
                    rows={4}
                  />
                </div>
              </div>

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
                            variant={(Array.isArray(editedWorkout.required_exercises) ? editedWorkout.required_exercises : []).includes(exercise.name) ? "default" : "secondary"}
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
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Speichere..." : "Speichern"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}