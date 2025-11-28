import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Home, Calendar, Trophy, Dumbbell } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { TrainingPathHeader } from "./TrainingPathHeader"

export const RepsCounter = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [trainingDaysThisMonth, setTrainingDaysThisMonth] = useState(0)

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

    // Load training days this month
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
        <Button variant="ghost" onClick={() => {
          navigate('/pro')
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('changeTab', { detail: 'wod' }))
          }, 50)
        }} size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Title */}
      <div className="text-center py-6">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">Rep Counter</h1>
        <p className="text-muted-foreground mt-2">Choose your counting mode</p>
      </div>

      {/* Mode Selection Cards */}
      <div className="px-4 space-y-4 pb-24">
        {/* Simple Mode */}
        <div 
          className="bg-muted/50 dark:bg-muted/30 p-6 cursor-pointer transition-all duration-300 hover:bg-muted dark:hover:bg-muted/50 rounded-2xl h-32 shadow-sm hover:scale-[1.02]"
          onClick={() => navigate('/reps-counter/simple')}
        >
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h3 className="text-xl font-bold">Simple</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Simple round counter with tap to increment
            </p>
          </div>
        </div>

        {/* Pro Mode */}
        <div 
          className="bg-muted/50 dark:bg-muted/30 p-6 cursor-pointer transition-all duration-300 hover:bg-muted dark:hover:bg-muted/50 rounded-2xl h-32 shadow-sm hover:scale-[1.02]"
          onClick={() => navigate('/reps-counter/pro')}
        >
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h3 className="text-xl font-bold">Pro</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Multi-round tracker with custom rep goals
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-2 z-50">
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
            onClick={() => navigate('/pro?openWod=true')}
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
