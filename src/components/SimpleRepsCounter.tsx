import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Home, Calendar, Trophy, Dumbbell, Minus, CheckCircle2, Check } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { TrainingPathHeader } from "./TrainingPathHeader"

export const SimpleRepsCounter = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [trainingDaysThisMonth, setTrainingDaysThisMonth] = useState(0)
  
  const [rounds, setRounds] = useState(0)
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

  const handleTap = () => {
    setRounds(prev => prev + 1)
    if (navigator.vibrate) {
      navigator.vibrate(50)
    }
  }

  const handleUndo = () => {
    setRounds(prev => Math.max(0, prev - 1))
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
    setRounds(0)
  }

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
        <Button variant="ghost" onClick={() => navigate('/reps-counter')} size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Title */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-foreground">Simple Counter</h1>
        <p className="text-sm text-muted-foreground mt-1">Tap to count rounds</p>
      </div>

      {/* Main Counter */}
      <div className="px-4 pb-40">
        <Card 
          className="relative cursor-pointer active:scale-95 transition-transform border-2"
          style={{ minHeight: '50vh' }}
          onClick={handleTap}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-8xl md:text-9xl font-bold text-primary">
                {rounds}
              </div>
              <div className="text-2xl text-muted-foreground mt-4">
                {rounds === 1 ? 'Round' : 'Rounds'}
              </div>
            </div>
          </div>
        </Card>
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
            disabled={rounds === 0}
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
            disabled={rounds === 0}
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

      {/* Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center space-y-6">
              {/* Success Icon */}
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="h-12 w-12 text-primary" />
                </div>
              </div>
              
              {/* Title */}
              <div>
                <h2 className="text-3xl font-bold mb-2">Workout Complete!</h2>
                <p className="text-muted-foreground">Congratulations on your performance</p>
              </div>

              {/* Stats Display */}
              <div className="bg-muted/50 rounded-lg p-6">
                <div className="text-6xl font-bold text-primary">{rounds}</div>
                <div className="text-lg text-muted-foreground mt-2">
                  {rounds === 1 ? 'Round' : 'Rounds'}
                </div>
              </div>

              {/* New Workout Button */}
              <Button className="w-full h-14 text-lg" onClick={handleFinish}>
                New Workout
              </Button>
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
