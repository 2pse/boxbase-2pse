import { useState, useEffect } from "react"
import { Trophy } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { useNavigate } from "react-router-dom"
import { useGymSettings } from "@/contexts/GymSettingsContext"

interface LeaderboardPositionProps {
  user: User
}

export const LeaderboardPosition: React.FC<LeaderboardPositionProps> = ({ user }) => {
  const navigate = useNavigate()
  const [position, setPosition] = useState<number | null>(null)
  const [totalUsers, setTotalUsers] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [leaderboardVisible, setLeaderboardVisible] = useState<boolean>(true)
  const { settings } = useGymSettings()
  const primaryColor = settings?.primary_color || '#B81243'

  useEffect(() => {
    loadLeaderboardPosition()
    
    // Listen for leaderboard visibility changes
    const handleVisibilityChange = () => {
      loadLeaderboardPosition()
    }
    
    window.addEventListener('leaderboardVisibilityChanged', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('leaderboardVisibilityChanged', handleVisibilityChange)
    }
  }, [user.id])

  const loadLeaderboardPosition = async () => {
    try {
      // First check if user has enabled leaderboard visibility
      const { data: profile } = await supabase
        .from('profiles')
        .select('leaderboard_visible')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile || profile.leaderboard_visible === false) {
        setLeaderboardVisible(false)
        setLoading(false)
        return
      }

      setLeaderboardVisible(true)

      const currentDate = new Date()
      const currentYear = currentDate.getFullYear()
      const currentMonth = currentDate.getMonth() + 1

      // Get current month's leaderboard data, only for users with leaderboard_visible = true
      const { data: leaderboardData, error } = await supabase
        .from('leaderboard_entries')
        .select('user_id, training_count, challenge_bonus_points')
        .eq('year', currentYear)
        .eq('month', currentMonth)

      if (error) throw error

      if (leaderboardData && leaderboardData.length > 0) {
        // Filter to only include users with leaderboard visibility enabled
        const visibleUserIds = leaderboardData.map(entry => entry.user_id)
        
        const { data: visibleProfiles } = await supabase
          .from('profiles')
          .select('user_id')
          .in('user_id', visibleUserIds)
          .eq('leaderboard_visible', true)

        const visibleUserIdsSet = new Set(visibleProfiles?.map(p => p.user_id) || [])
        const filteredLeaderboardData = leaderboardData.filter(entry => 
          visibleUserIdsSet.has(entry.user_id)
        )

        // Calculate total scores and sort by total score
        const sortedData = filteredLeaderboardData
          .map(entry => ({
            ...entry,
            total_score: entry.training_count + (entry.challenge_bonus_points || 0)
          }))
          .sort((a, b) => b.total_score - a.total_score)
        
        const userPosition = sortedData.findIndex(entry => entry.user_id === user.id) + 1
        setPosition(userPosition > 0 ? userPosition : null)
        setTotalUsers(sortedData.length)
      } else {
        setPosition(null)
        setTotalUsers(0)
      }
    } catch (error) {
      console.error('Error loading leaderboard position:', error)
      setPosition(null)
      setTotalUsers(0)
      setLeaderboardVisible(false)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !leaderboardVisible || position === null || totalUsers === 0) {
    return null
  }

  const handleLeaderboardClick = () => {
    // Use window.dispatchEvent to trigger tab change in Dashboard
    window.dispatchEvent(new CustomEvent('changeTab', { detail: 'leaderboard' }))
  }

  return (
    <div 
      onClick={handleLeaderboardClick}
      className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <Trophy className="h-6 w-6 text-black dark:text-white" />
      <span className="text-black dark:text-white font-medium text-lg">
        {position}
      </span>
    </div>
  )
}