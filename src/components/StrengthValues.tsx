import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useNavigate } from "react-router-dom"
import { useToast } from "@/hooks/use-toast"

export const StrengthValues = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  
  const handleBack = () => {
    navigate('/pro?openProfile=true')
  }
  
  // Standard 1RM Werte
  const [frontSquat1rm, setFrontSquat1rm] = useState("")
  const [backSquat1rm, setBackSquat1rm] = useState("")
  const [deadlift1rm, setDeadlift1rm] = useState("")
  const [benchPress1rm, setBenchPress1rm] = useState("")
  const [snatch1rm, setSnatch1rm] = useState("")
  const [clean1rm, setClean1rm] = useState("")
  const [jerk1rm, setJerk1rm] = useState("")
  const [cleanAndJerk1rm, setCleanAndJerk1rm] = useState("")
  
  // Zusätzliche Übungen
  const [extraLifts, setExtraLifts] = useState<{name: string, weight: string}[]>([])

  useEffect(() => {
    loadStrengthValues()
  }, [])

  const loadStrengthValues = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('front_squat_1rm, back_squat_1rm, deadlift_1rm, bench_press_1rm, snatch_1rm, clean_1rm, jerk_1rm, clean_and_jerk_1rm, extra_lifts')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profile) {
        setFrontSquat1rm((profile as any).front_squat_1rm?.toString() || "")
        setBackSquat1rm((profile as any).back_squat_1rm?.toString() || "")
        setDeadlift1rm((profile as any).deadlift_1rm?.toString() || "")
        setBenchPress1rm((profile as any).bench_press_1rm?.toString() || "")
        setSnatch1rm((profile as any).snatch_1rm?.toString() || "")
        setClean1rm((profile as any).clean_1rm?.toString() || "")
        setJerk1rm((profile as any).jerk_1rm?.toString() || "")
        setCleanAndJerk1rm((profile as any).clean_and_jerk_1rm?.toString() || "")
        setExtraLifts(((profile as any).extra_lifts as {name: string, weight: string}[]) || [])
      }
    } catch (error) {
      console.error('Error loading strength values:', error)
    }
  }

  const saveStrengthValues = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('profiles')
        .update({
          front_squat_1rm: frontSquat1rm ? parseFloat(frontSquat1rm) : null,
          back_squat_1rm: backSquat1rm ? parseFloat(backSquat1rm) : null,
          deadlift_1rm: deadlift1rm ? parseFloat(deadlift1rm) : null,
          bench_press_1rm: benchPress1rm ? parseFloat(benchPress1rm) : null,
          snatch_1rm: snatch1rm ? parseFloat(snatch1rm) : null,
          clean_1rm: clean1rm ? parseFloat(clean1rm) : null,
          jerk_1rm: jerk1rm ? parseFloat(jerk1rm) : null,
          clean_and_jerk_1rm: cleanAndJerk1rm ? parseFloat(cleanAndJerk1rm) : null,
          extra_lifts: extraLifts
        })
        .eq('user_id', user.id)

      if (error) throw error

      toast({
        title: "Strength values saved",
        description: "Your strength values have been successfully saved."
      })
    } catch (error) {
      console.error('Error saving strength values:', error)
      toast({
        title: "Error",
        description: "Strength values could not be saved.",
        variant: "destructive"
      })
    }
  }

  const addExtraLift = () => {
    setExtraLifts([...extraLifts, { name: "", weight: "" }])
  }

  const removeExtraLift = (index: number) => {
    setExtraLifts(extraLifts.filter((_, i) => i !== index))
  }

  const updateExtraLift = (index: number, field: 'name' | 'weight', value: string) => {
    const newLifts = [...extraLifts]
    newLifts[index][field] = value
    setExtraLifts(newLifts)
  }

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      <div className="max-w-2xl mx-auto p-4 pb-24">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Strength Values</h1>
          </div>
        </div>

        {/* Standard Kraftwerte */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>1RM Basic Exercises</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter your 1 rep max for future training references
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: "Front Squat", value: frontSquat1rm, setter: setFrontSquat1rm },
              { name: "Back Squat", value: backSquat1rm, setter: setBackSquat1rm },
              { name: "Deadlift", value: deadlift1rm, setter: setDeadlift1rm },
              { name: "Bench Press", value: benchPress1rm, setter: setBenchPress1rm },
              { name: "Snatch", value: snatch1rm, setter: setSnatch1rm },
              { name: "Clean", value: clean1rm, setter: setClean1rm },
              { name: "Jerk", value: jerk1rm, setter: setJerk1rm },
              { name: "Clean & Jerk", value: cleanAndJerk1rm, setter: setCleanAndJerk1rm }
            ].map(({ name, value, setter }) => (
              <div key={name} className="flex gap-2 items-center">
                <Label className="text-sm font-medium min-w-24 text-right">{name}:</Label>
                <Input 
                  type="number" 
                  step="0.5" 
                  value={value} 
                  onChange={(e) => setter(e.target.value)} 
                  placeholder="kg" 
                  className="w-20" 
                />
                <span className="text-sm text-muted-foreground">kg</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Zusätzliche Übungen */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Additional Exercises</CardTitle>
            <p className="text-sm text-muted-foreground">
              Add any additional exercises and their values.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {extraLifts.map((lift, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Exercise Name</Label>
                  <Input
                    placeholder="e.g. Overhead Press"
                    value={lift.name}
                    onChange={(e) => updateExtraLift(index, 'name', e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label>Weight/Reps</Label>
                  <Input
                    placeholder="e.g. 60kg or 15 reps"
                    type="text"
                    value={lift.weight}
                    onChange={(e) => updateExtraLift(index, 'weight', e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeExtraLift(index)}
                  className="mb-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            <Button variant="outline" onClick={addExtraLift} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Exercise
            </Button>
          </CardContent>
        </Card>


        <Button onClick={saveStrengthValues} className="w-full">
          Save Strength Values
        </Button>
      </div>
    </div>
  )
}