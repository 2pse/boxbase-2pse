import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, RotateCcw, Lightbulb, Timer } from "lucide-react"
import { WorkoutChatInterface } from "./WorkoutChatInterface"
import { WorkoutTimer } from "./WorkoutTimer"

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
}

interface BodybuildingWorkout {
  id: string
  title: string
  focus_area: string
  difficulty: string
  workout_content: string
  notes?: string
}

interface WorkoutDisplayProps {
  workout: CrossfitWorkout | BodybuildingWorkout
  workoutType: 'crossfit' | 'bodybuilding'
  onNewWorkout: () => void
  onReset: () => void
  isGenerating?: boolean
}

export const WorkoutDisplay = ({ workout, workoutType, onNewWorkout, onReset, isGenerating }: WorkoutDisplayProps) => {
  const [showAIChat, setShowAIChat] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const isCrossfitWorkout = (w: any): w is CrossfitWorkout => workoutType === 'crossfit'

  if (showAIChat) {
    return (
      <WorkoutChatInterface 
        workout={workout}
        workoutType={workoutType}
        onClose={() => setShowAIChat(false)}
      />
    )
  }

  if (showTimer) {
    return (
      <div className="min-h-screen bg-background">
        <div className="px-4 pt-4 pb-2">
          <Button variant="ghost" onClick={() => setShowTimer(false)} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        
        <div className="text-center py-6">
          <h1 className="text-3xl font-bold text-foreground">Timer</h1>
        </div>
        
        <WorkoutTimer embedded />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pt-4 px-4 pb-20">
      {/* Back button at top left */}
      <div className="flex justify-start">
        <Button 
          onClick={onReset}
          variant="ghost"
          size="sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
      
      {/* Workout Type Heading */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-black mb-6">
          {workoutType === 'crossfit' ? 'Functional Fitness' : 'Bodybuilding'}
        </h1>
      </div>
      
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{workout.title}</CardTitle>
          <div className="flex justify-center gap-2 flex-wrap">
            {isCrossfitWorkout(workout) ? (
              <>
                <Badge variant="secondary">{workout.workout_type}</Badge>
                <Badge variant="outline">von {workout.author_nickname}</Badge>
              </>
            ) : (
              <>
                <Badge variant="secondary">{workout.focus_area}</Badge>
                <Badge variant="outline">{workout.difficulty}</Badge>
              </>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">Workout</h3>
            <div className="bg-muted p-4 rounded-lg">
              <pre className="whitespace-pre-wrap font-mono text-sm">{workout.workout_content}</pre>
            </div>
          </div>

          {isCrossfitWorkout(workout) && (workout.scaling_beginner || workout.scaling_scaled || workout.scaling_rx) && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Scaling-Optionen</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {workout.scaling_beginner && (
                  <div>
                    <Badge className="mb-2" variant="outline">Beginner</Badge>
                    <div className="bg-muted p-3 rounded text-sm">
                      <pre className="whitespace-pre-wrap">{workout.scaling_beginner}</pre>
                    </div>
                  </div>
                )}
                {workout.scaling_scaled && (
                  <div>
                    <Badge className="mb-2" variant="outline">Scaled</Badge>
                    <div className="bg-muted p-3 rounded text-sm">
                      <pre className="whitespace-pre-wrap">{workout.scaling_scaled}</pre>
                    </div>
                  </div>
                )}
                {workout.scaling_rx && (
                  <div>
                    <Badge className="mb-2" variant="outline">RX</Badge>
                    <div className="bg-muted p-3 rounded text-sm">
                      <pre className="whitespace-pre-wrap">{workout.scaling_rx}</pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {workout.notes && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Notizen</h3>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm">{workout.notes}</pre>
              </div>
            </div>
          )}

          <Separator />

          {/* Buttons arranged in two rows */}
          <div className="space-y-4 mt-6">
            {/* First row: Nächstes and Timer side by side */}
            <div className="flex justify-center gap-4">
              <Button 
                onClick={onNewWorkout}
                disabled={isGenerating}
                variant="ghost"
                size="lg"
                className="flex flex-col items-center p-4 h-auto min-w-[80px]"
              >
                <RotateCcw className="h-6 w-6 mb-1" />
                <span className="text-xs">Next</span>
              </Button>
              
              <Button 
                onClick={() => setShowTimer(true)}
                variant="ghost"
                size="lg"
                className="flex flex-col items-center p-4 h-auto min-w-[80px]"
              >
                <Timer className="h-6 w-6 mb-1" />
                <span className="text-xs">Timer</span>
              </Button>
            </div>
            
            {/* Second row: RISE KI-Coach centered */}
            <div className="flex justify-center">
              <Button 
                onClick={() => setShowAIChat(true)}
                variant="ghost"
                size="lg"
                className="flex flex-col items-center p-4 h-auto min-w-[120px]"
              >
                <Lightbulb className="h-6 w-6 mb-1" />
                <span className="text-xs">AI Coach</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}