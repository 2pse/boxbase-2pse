import { useState, useEffect } from "react"
import { Award } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"

interface DashboardChallengeCardProps {
  user: User
  onChallengeClick?: (challenge: any, progress: any) => void
}

export const DashboardChallengeCard: React.FC<DashboardChallengeCardProps> = ({
  user,
  onChallengeClick
}) => {
  const [currentChallenge, setCurrentChallenge] = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCurrentChallenge()
  }, [user.id])

  const loadCurrentChallenge = async () => {
    try {
      const currentDate = new Date()
      const currentMonth = currentDate.getMonth() + 1
      const currentYear = currentDate.getFullYear()

      // Try to get primary challenge first
      let { data: challenge, error } = await supabase
        .from("monthly_challenges")
        .select("*")
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .eq("is_archived", false)
        .eq("is_primary", true)
        .maybeSingle()

      // If no primary challenge, get any challenge for the month
      if (!challenge) {
        const { data: fallbackChallenge, error: fallbackError } = await supabase
          .from("monthly_challenges")
          .select("*")
          .eq("month", currentMonth)
          .eq("year", currentYear)
          .eq("is_archived", false)
          .limit(1)
          .maybeSingle()

        if (fallbackError && fallbackError.code !== 'PGRST116') throw fallbackError
        challenge = fallbackChallenge
      }

      if (error && error.code !== 'PGRST116') throw error

      if (challenge) {
        setCurrentChallenge(challenge)

        // Load user progress
        const { data: userProgress } = await supabase
          .from("user_challenge_progress")
          .select("*")
          .eq("challenge_id", challenge.id)
          .eq("user_id", user.id)
          .maybeSingle()

        setProgress(userProgress || {
          completed_checkpoints: 0,
          is_completed: false
        })
      }

      setLoading(false)
    } catch (error) {
      console.error("Error loading current challenge:", error)
      setLoading(false)
    }
  }

  const getProgressPercentage = () => {
    if (!currentChallenge || !progress) return 0
    return Math.round((progress.completed_checkpoints / currentChallenge.checkpoint_count) * 100)
  }

  const handleClick = async () => {
    if (!currentChallenge) return

    if (!progress || !progress.id) {
      // Create progress if it doesn't exist
      const { data: newProgress, error } = await supabase
        .from("user_challenge_progress")
        .insert({
          user_id: user.id,
          challenge_id: currentChallenge.id,
          completed_checkpoints: 0,
          is_completed: false
        })
        .select()
        .single()

      if (error) {
        console.error("Error creating progress:", error)
        return
      }

      setProgress(newProgress)
      onChallengeClick?.(currentChallenge, newProgress)
    } else {
      onChallengeClick?.(currentChallenge, progress)
    }
  }

  const renderProgressCircle = () => {
    const percentage = getProgressPercentage()
    const circumference = 2 * Math.PI * 20 // radius = 20
    const strokeDasharray = circumference
    const strokeDashoffset = circumference - (percentage / 100) * circumference

    return (
      <div className="relative w-8 md:w-14 h-8 md:h-14">
        <svg className="w-8 md:w-14 h-8 md:h-14 transform -rotate-90" viewBox="0 0 60 60">
          {/* Background circle */}
          <circle
            cx="30"
            cy="30"
            r="20"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            className="text-gray-300 dark:text-gray-600 md:[stroke-width:6]"
          />
          {/* Progress circle */}
          <circle
            cx="30"
            cy="30"
            r="20"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className="text-primary transition-all duration-300 md:[stroke-width:6]"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[8px] md:text-xs font-bold">{Math.round(percentage)}%</span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 h-32 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading Challenge...</div>
      </div>
    )
  }

  if (!currentChallenge) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 h-32 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No challenge available</p>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-3.5 md:p-8 hover:bg-gray-150 dark:hover:bg-gray-700 transition-all hover:scale-[1.02] h-22 md:h-[155px] w-full text-left relative"
    >
      <div className="absolute top-2.5 md:top-4.5 right-2.5 md:right-4.5">
        {renderProgressCircle()}
      </div>
      
      <div className="flex items-center justify-center h-full">
        <h3 className="text-base md:text-3.5xl font-semibold text-foreground">
          Monthly Challenge
        </h3>
      </div>
    </button>
  )
}