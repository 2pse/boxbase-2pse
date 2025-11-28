import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Home, Calendar, Trophy, Weight } from "lucide-react"
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
        <Button variant="ghost" onClick={() => navigate('/pro?tab=wod')} size="sm">
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
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-2 md:p-3 z-50 h-[72px] md:h-[100px]">
        <div className="flex justify-around max-w-md md:max-w-2xl mx-auto h-full">
          <button
            onClick={() => navigate('/pro')}
            className="flex flex-col items-center gap-1 md:gap-2 h-full py-2 md:py-3 px-3 md:px-4 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-hover-neutral"
          >
            <Home className="h-5 w-5 md:h-[32px] md:w-[32px]" />
            <span className="text-xs md:text-sm font-medium">Overview</span>
          </button>
          <button
            onClick={() => navigate('/pro')}
            className="flex flex-col items-center gap-1 md:gap-2 h-full py-2 md:py-3 px-3 md:px-4 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-hover-neutral"
          >
            <Calendar className="h-5 w-5 md:h-[32px] md:w-[32px]" />
            <span className="text-xs md:text-sm font-medium">Courses</span>
          </button>
          <button
            onClick={() => navigate('/pro?tab=wod')}
            className="flex flex-col items-center gap-1 md:gap-2 h-full py-2 md:py-3 px-3 md:px-4 rounded-md transition-colors text-primary bg-primary/10"
          >
            <Weight className="h-5 w-5 md:h-[32px] md:w-[32px]" />
            <span className="text-xs md:text-sm font-medium">Workout</span>
          </button>
          <button
            onClick={() => navigate('/pro')}
            className="flex flex-col items-center gap-1 md:gap-2 h-full py-2 md:py-3 px-3 md:px-4 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-hover-neutral"
          >
            <Trophy className="h-5 w-5 md:h-[32px] md:w-[32px]" />
            <span className="text-xs md:text-sm font-medium">Leaderboard</span>
          </button>
        </div>
      </div>
    </div>
  )
}
