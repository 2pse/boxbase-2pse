import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Home, Calendar, Trophy, Dumbbell, Minus, CheckCircle2, Check, Plus, X, GripVertical, Play } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { TrainingPathHeader } from "./TrainingPathHeader"

interface Round {
  id: string
  targetReps: number
  completedReps: number
}

export const ProRepsCounter = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [trainingDaysThisMonth, setTrainingDaysThisMonth] = useState(0)
  
  const [isSetupMode, setIsSetupMode] = useState(true)
  const [rounds, setRounds] = useState<Round[]>([
    { id: '1', targetReps: 10, completedReps: 0 }
  ])
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [isHoldingFinish, setIsHoldingFinish] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [showSummary, setShowSummary] = useState(false)

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUser(user)

    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', user.id)
      .single()

    if (profile) setUserAvatar(profile.avatar_url)

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const { count } = await supabase
      .from('training_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('session_date', startOfMonth.toISOString().split('T')[0])

    setTrainingDaysThisMonth(count || 0)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  // Setup Mode Functions
  const addRound = () => {
    const newRound: Round = {
      id: String(rounds.length + 1),
      targetReps: 10,
      completedReps: 0
    }
    setRounds([...rounds, newRound])
  }

  const removeRound = (id: string) => {
    if (rounds.length > 1) {
      setRounds(rounds.filter(r => r.id !== id))
    }
  }

  const updateTargetReps = (id: string, value: number) => {
    setRounds(rounds.map(r => 
      r.id === id ? { ...r, targetReps: Math.max(1, value) } : r
    ))
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newRounds = [...rounds]
    const draggedRound = newRounds[draggedIndex]
    newRounds.splice(draggedIndex, 1)
    newRounds.splice(index, 0, draggedRound)
    
    setRounds(newRounds)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const startWorkout = () => {
    setIsSetupMode(false)
    setCurrentRoundIndex(0)
  }

  // Tracking Mode Functions
  const handleTap = () => {
    if (currentRoundIndex >= rounds.length) return

    const currentRound = rounds[currentRoundIndex]
    const newCompletedReps = currentRound.completedReps + 1

    const updatedRounds = [...rounds]
    updatedRounds[currentRoundIndex] = {
      ...currentRound,
      completedReps: newCompletedReps
    }
    setRounds(updatedRounds)

    if (navigator.vibrate) {
      navigator.vibrate(50)
    }

    // Auto-advance to next round when target reached
    if (newCompletedReps >= currentRound.targetReps) {
      setTimeout(() => {
        if (currentRoundIndex < rounds.length - 1) {
          setCurrentRoundIndex(currentRoundIndex + 1)
        }
      }, 300)
    }
  }

  const handleUndo = () => {
    if (currentRoundIndex >= rounds.length) return

    const currentRound = rounds[currentRoundIndex]
    
    if (currentRound.completedReps > 0) {
      const updatedRounds = [...rounds]
      updatedRounds[currentRoundIndex] = {
        ...currentRound,
        completedReps: currentRound.completedReps - 1
      }
      setRounds(updatedRounds)
    } else if (currentRoundIndex > 0) {
      setCurrentRoundIndex(currentRoundIndex - 1)
    }

    if (navigator.vibrate) {
      navigator.vibrate(30)
    }
  }

  const handleFinishStart = () => {
    setIsHoldingFinish(true)
    let progress = 0
    const interval = setInterval(() => {
      progress += 4
      setHoldProgress(progress)
      if (progress >= 100) {
        clearInterval(interval)
        setShowSummary(true)
        setIsHoldingFinish(false)
        setHoldProgress(0)
      }
    }, 25)

    ;(window as any).finishInterval = interval
  }

  const handleFinishEnd = () => {
    if ((window as any).finishInterval) {
      clearInterval((window as any).finishInterval)
    }
    setIsHoldingFinish(false)
    setHoldProgress(0)
  }

  const handleFinish = () => {
    setShowSummary(false)
    setRounds([{ id: '1', targetReps: 10, completedReps: 0 }])
    setCurrentRoundIndex(0)
    setIsSetupMode(true)
  }

  const handleRepeatWorkout = () => {
    const resetRounds = rounds.map(round => ({
      ...round,
      completedReps: 0
    }))
    setRounds(resetRounds)
    setShowSummary(false)
    setCurrentRoundIndex(0)
  }

  // Calculated values
  const totalRepsCompleted = rounds.reduce((sum, round) => sum + round.completedReps, 0)
  const completedRounds = rounds.filter(r => r.completedReps >= r.targetReps).length
  const incompleteRound = rounds.find(r => r.completedReps > 0 && r.completedReps < r.targetReps)
  const remainingRepsFromIncompleteRound = incompleteRound ? incompleteRound.completedReps : 0
  const currentRound = rounds[currentRoundIndex]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      {user && (
        <TrainingPathHeader
          userAvatar={userAvatar}
          onProfileClick={() => {}}
          onLogout={handleLogout}
          trainingDaysThisMonth={trainingDaysThisMonth}
          totalDaysInMonth={new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}
          user={user}
        />
      )}

      {/* Back Button */}
      <div className="px-4 pt-4 pb-2">
        <Button variant="ghost" onClick={() => isSetupMode ? navigate('/reps-counter') : setIsSetupMode(true)} size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Title */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-foreground">Pro Counter</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isSetupMode ? 'Configure your rounds' : `Round ${currentRoundIndex + 1} of ${rounds.length}`}
        </p>
      </div>

      {/* Setup Mode */}
      {isSetupMode && (
        <div className="px-4 pb-24 space-y-4">
          {rounds.map((round, index) => (
            <div 
              key={round.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`bg-muted/50 rounded-xl p-4 border-2 border-muted transition-all ${
                draggedIndex === index ? 'opacity-50 scale-95' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Drag Handle */}
                <div className="text-muted-foreground cursor-grab active:cursor-grabbing">
                  <GripVertical className="h-5 w-5" />
                </div>
                
                <div className="flex-1 flex items-center gap-4">
                  {/* Round Number Badge */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-lg">
                    {index + 1}
                  </div>
                  
                  {/* Rep Input */}
                  <div className="flex-1">
                    <Input
                      type="number"
                      min="1"
                      value={round.targetReps}
                      onChange={(e) => updateTargetReps(round.id, parseInt(e.target.value) || 1)}
                      className="h-14 text-2xl font-bold text-center bg-background border-2 border-primary/20 focus:border-primary"
                    />
                  </div>
                  
                  <div className="text-muted-foreground font-medium">Reps</div>
                </div>

                {/* Remove Button */}
                {rounds.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRound(round.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {/* Add Round Button */}
          <Button
            variant="outline"
            className="w-full h-16 text-lg border-2 border-dashed border-primary/30 text-primary"
            onClick={addRound}
          >
            <Plus className="h-6 w-6 mr-2" />
            Add Round
          </Button>

          {/* Start Workout Button */}
          <Button
            className="w-full h-16 text-xl mt-6 bg-primary"
            onClick={startWorkout}
          >
            <Play className="h-6 w-6 mr-2" />
            Start Workout
          </Button>
        </div>
      )}

      {/* Tracking Mode */}
      {!isSetupMode && !showSummary && (
        <>
          <div className="px-4 pb-40">
            {/* Progress Header */}
            <div className="mb-4">
              <Progress 
                value={currentRound ? (currentRound.completedReps / currentRound.targetReps) * 100 : 0} 
                className="h-3" 
              />
            </div>

            {/* Main Counter Display */}
            <Card 
              className="relative cursor-pointer active:scale-95 transition-transform border-2 mb-4"
              style={{ minHeight: '35vh' }}
              onClick={handleTap}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-7xl md:text-8xl font-bold text-primary">
                    {currentRound?.completedReps || 0}
                    <span className="text-4xl text-muted-foreground">
                      /{currentRound?.targetReps || 0}
                    </span>
                  </div>
                  <div className="text-xl text-muted-foreground mt-4">
                    Reps
                  </div>
                </div>
              </div>
            </Card>

            {/* Round Indicator Circles */}
            <div className="flex flex-wrap gap-3 justify-center">
              {rounds.map((round, index) => {
                const isCompleted = round.completedReps >= round.targetReps
                const isCurrent = index === currentRoundIndex
                
                return (
                  <div
                    key={round.id}
                    className={`
                      relative w-14 h-14 rounded-full flex items-center justify-center font-bold text-base
                      transition-all duration-300
                      ${isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                      ${isCurrent ? 'ring-4 ring-primary ring-offset-2 scale-110' : ''}
                    `}
                  >
                    {isCompleted ? (
                      <Check className="h-6 w-6" />
                    ) : (
                      <span>{round.targetReps}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Fixed Button Area - above navigation */}
          <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 bg-background z-45">
            <div className="grid grid-cols-3 gap-3">
              {/* Undo Button */}
              <Button 
                variant="outline" 
                size="lg"
                className="h-16 border-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  handleUndo()
                }}
                disabled={currentRoundIndex === 0 && currentRound?.completedReps === 0}
              >
                <Minus className="h-7 w-7" />
              </Button>
              
              {/* Finish Button */}
              <Button 
                size="lg"
                className="col-span-2 h-16 bg-gradient-to-r from-primary to-primary/80 relative overflow-hidden"
                onTouchStart={handleFinishStart}
                onTouchEnd={handleFinishEnd}
                onMouseDown={handleFinishStart}
                onMouseUp={handleFinishEnd}
                onMouseLeave={handleFinishEnd}
              >
                <div 
                  className="absolute inset-0 bg-primary-foreground/20 transition-all duration-100 origin-left"
                  style={{ transform: `scaleX(${holdProgress / 100})` }}
                />
                <CheckCircle2 className="h-6 w-6 mr-2 relative z-10" />
                <span className="text-lg font-bold relative z-10">
                  {isHoldingFinish ? 'Hold...' : 'Finish'}
                </span>
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center space-y-4">
              {/* Success Icon */}
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="h-10 w-10 text-primary" />
                </div>
              </div>
              
              <div>
                <h2 className="text-2xl font-bold mb-1">Workout Complete!</h2>
                <p className="text-sm text-muted-foreground">Congratulations on your performance</p>
              </div>

              {/* Stats Grid */}
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-4xl font-bold text-primary">{completedRounds}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {completedRounds === 1 ? 'Round' : 'Rounds'}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-4xl font-bold text-primary">
                      {remainingRepsFromIncompleteRound > 0 ? remainingRepsFromIncompleteRound : totalRepsCompleted}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {remainingRepsFromIncompleteRound > 0 
                        ? (remainingRepsFromIncompleteRound === 1 ? 'Rep' : 'Reps')
                        : 'Total Reps'
                      }
                    </div>
                  </div>
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  {totalRepsCompleted} total reps completed
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <Button className="w-full h-12 text-base" onClick={handleFinish} variant="default">
                  New Workout
                </Button>
                
                <Button className="w-full h-10 text-sm" onClick={handleRepeatWorkout} variant="outline">
                  Repeat Workout
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-2 z-40">
        <div className="flex justify-around max-w-md mx-auto">
          <button
            onClick={() => navigate('/pro')}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Home className="h-5 w-5" />
            <span className="text-xs">Overview</span>
          </button>
          <button
            onClick={() => navigate('/pro')}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Calendar className="h-5 w-5" />
            <span className="text-xs">Courses</span>
          </button>
          <button
            onClick={() => navigate('/pro?tab=wod')}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 rounded-md transition-colors text-primary bg-primary/10"
          >
            <Dumbbell className="h-5 w-5" />
            <span className="text-xs">Workout</span>
          </button>
          <button
            onClick={() => navigate('/pro')}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Trophy className="h-5 w-5" />
            <span className="text-xs">Leaderboard</span>
          </button>
        </div>
      </div>
    </div>
  )
}
