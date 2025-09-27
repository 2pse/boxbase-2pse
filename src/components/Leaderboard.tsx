import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trophy, Medal, Award, Dumbbell, Calendar, CheckCircle } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { AvatarUpload } from "@/components/AvatarUpload"
import { ProfileImageViewer } from "@/components/ProfileImageViewer"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getDisplayName } from "@/lib/nameUtils"
import { Database } from "@/integrations/supabase/types"

interface LeaderboardEntry {
  id: string
  user_id: string
  training_count: number
  challenge_bonus_points: number
  display_name: string
  avatar_url: string | null
  year: number
  month: number
  total_score: number
  hasCompletedChallenge: boolean
}

export const Leaderboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProfile, setSelectedProfile] = useState<{ imageUrl: string | null; displayName: string } | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'trainer' | 'member' | null>(null)
  const [activeTab, setActiveTab] = useState<'month' | 'year'>('month')

  useEffect(() => {
    let mounted = true
    
    const loadData = async () => {
      if (mounted) {
        await loadCurrentUserRole()
        await loadLeaderboard(activeTab)
      }
    }
    
    // Listen for leaderboard visibility changes
    const handleVisibilityChange = () => {
      if (mounted) {
        loadLeaderboard(activeTab)
      }
    }
    
    window.addEventListener('leaderboardVisibilityChanged', handleVisibilityChange)

    const loadCurrentUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single()

        setCurrentUserRole(data?.role as any || 'member')
      } catch (error) {
        console.error('Error loading user role:', error)
        setCurrentUserRole('member')
      }
    }
    
    loadData()
    
    return () => {
      mounted = false
      window.removeEventListener('leaderboardVisibilityChanged', handleVisibilityChange)
    }
  }, [activeTab])

  const loadLeaderboard = async (type: 'month' | 'year' = activeTab) => {
    try {
      setLoading(true)
      const currentDate = new Date()
      const currentYear = currentDate.getFullYear()
      const currentMonth = currentDate.getMonth() + 1

      let leaderboardData, leaderboardError

      if (type === 'month') {
        // Get monthly leaderboard entries
        const result = await supabase
          .from('leaderboard_entries')
          .select('*')
          .eq('year', currentYear)
          .eq('month', currentMonth)
          .order('training_count', { ascending: false })
          .order('challenge_bonus_points', { ascending: false })
          .limit(100)
        
        leaderboardData = result.data
        leaderboardError = result.error
      } else {
        // Get yearly leaderboard by summing all months for the current year
        const { data: yearlyData, error } = await supabase
          .from('leaderboard_entries')
          .select('user_id, training_count, challenge_bonus_points')
          .eq('year', currentYear)
          .order('training_count', { ascending: false })
        
        if (error) {
          leaderboardError = error
        } else {
          // Aggregate data by user_id
          const userTotals = new Map()
          yearlyData?.forEach(entry => {
            const existing = userTotals.get(entry.user_id) || { 
              user_id: entry.user_id, 
              training_count: 0, 
              challenge_bonus_points: 0,
              year: currentYear,
              month: 0, // Not applicable for yearly
              id: `yearly-${entry.user_id}`
            }
            existing.training_count += entry.training_count
            existing.challenge_bonus_points += entry.challenge_bonus_points || 0
            userTotals.set(entry.user_id, existing)
          })
          
          leaderboardData = Array.from(userTotals.values())
            .sort((a, b) => (b.training_count + b.challenge_bonus_points) - (a.training_count + a.challenge_bonus_points))
            .slice(0, 100)
        }
      }

      if (leaderboardError) {
        console.error('Error loading leaderboard:', leaderboardError)
        setLeaderboard([])
        return
      }

      if (!leaderboardData || leaderboardData.length === 0) {
        setLeaderboard([])
        return
      }

      // Get all user IDs from leaderboard
      const userIds = leaderboardData.map(entry => entry.user_id)

      // Get user profiles for display names and avatars, only visible users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, first_name, nickname, avatar_url, leaderboard_visible')
        .in('user_id', userIds)
        .eq('leaderboard_visible', true)

      if (profilesError) {
        console.error('Error loading profiles:', profilesError)
        setLeaderboard([])
        return
      }

      // Get challenge completion status
      let challengeProgress = [];
      try {
        if (type === 'month') {
          // For monthly view, check current month's challenges
          const { data: progressData, error: progressError } = await supabase
            .from('user_challenge_progress')
            .select('user_id, is_completed')
            .eq('is_completed', true)
            .in('user_id', userIds);

          if (!progressError) {
            challengeProgress = progressData || [];
          }
        } else {
          // For yearly view, count all completed challenges in the year
          const { data: progressData, error: progressError } = await supabase
            .from('user_challenge_progress')
            .select('user_id, is_completed')
            .eq('is_completed', true)
            .in('user_id', userIds);

          if (!progressError) {
            challengeProgress = progressData || [];
          }
        }
      } catch (error) {
        console.warn('Could not load challenge progress:', error);
      }

      // Combine leaderboard data with profile info and calculate total score
      // Only include users who have enabled leaderboard visibility
      const leaderboardWithProfiles = leaderboardData
        .filter(entry => profiles?.some(p => p.user_id === entry.user_id && p.leaderboard_visible))
        .map(entry => {
          const profile = profiles?.find(p => p.user_id === entry.user_id)
          const hasCompletedChallenge = challengeProgress?.some(cp => cp.user_id === entry.user_id) || false
          const totalScore = entry.training_count + (entry.challenge_bonus_points || 0)
          return {
            ...entry,
            challenge_bonus_points: entry.challenge_bonus_points || 0,
            display_name: profile ? getDisplayName(profile, currentUserRole) : 'Unbekannt',
            avatar_url: profile?.avatar_url || null,
            total_score: totalScore,
            hasCompletedChallenge
          }
        }).sort((a, b) => b.total_score - a.total_score) // Sort by total score
          .slice(0, 30) // Limit to top 30 AFTER sorting

      setLeaderboard(leaderboardWithProfiles)
    } catch (error) {
      console.error('Error loading leaderboard:', error)
      setLeaderboard([])
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />
      case 3:
        return <Award className="h-6 w-6 text-orange-500" />
      default:
        return <div className="h-6 w-6 flex items-center justify-center text-muted-foreground font-bold">{position}</div>
    }
  }

  const getRankColor = (position: number) => {
    switch (position) {
      case 1:
        return "bg-gradient-to-r from-yellow-100 to-yellow-200 border-yellow-300 dark:from-yellow-900/30 dark:to-yellow-800/30 dark:border-yellow-600"
      case 2:
        return "bg-gradient-to-r from-gray-100 to-gray-200 border-gray-300 dark:from-gray-800/50 dark:to-gray-700/50 dark:border-gray-600"
      case 3:
        return "bg-gradient-to-r from-orange-100 to-orange-200 border-orange-300 dark:from-orange-900/30 dark:to-orange-800/30 dark:border-orange-600"
      default:
        return "bg-card border-border"
    }
  }

  const currentMonth = new Date().toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  })

  const getRemainingDaysInMonth = () => {
    const today = new Date()
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const remainingDays = lastDayOfMonth.getDate() - today.getDate()
    return remainingDays
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Loading Leaderboard...</h2>
        </div>
      </div>
    )
  }

  const handleTabChange = (value: string) => {
    const newTab = value as 'month' | 'year'
    setActiveTab(newTab)
    loadLeaderboard(newTab)
  }

  const getHeaderText = () => {
    if (activeTab === 'month') {
      return `Top 30 in ${new Date().toLocaleDateString('en-US', { month: 'long' })}`
    } else {
      return `Top 30 in ${new Date().getFullYear()}`
    }
  }

  const getEmptyStateText = () => {
    if (activeTab === 'month') {
      return "No trainings in this month yet"
    } else {
      return "No trainings in this year yet"
    }
  }

  return (
    <div className="h-[calc(100vh-8rem)] overflow-auto p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6 relative">
          <h1 className="text-2xl font-bold mb-2">Leaderboard</h1>
          <p className="text-muted-foreground">{getHeaderText()}</p>
          {activeTab === 'month' && (
            <div className="absolute top-0 right-0 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">{getRemainingDaysInMonth()}</span>
              <Calendar className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-6 mb-6">
          <button
            onClick={() => handleTabChange('month')}
            className={`text-base font-medium pb-1 border-b-2 transition-colors ${
              activeTab === 'month'
                ? 'text-foreground border-foreground'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => handleTabChange('year')}
            className={`text-base font-medium pb-1 border-b-2 transition-colors ${
              activeTab === 'year'
                ? 'text-foreground border-foreground'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            Year
          </button>
        </div>

        <div className="space-y-3 pb-2">
              {leaderboard.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">{getEmptyStateText()}</p>
                  </CardContent>
                </Card>
              ) : (
                leaderboard.map((entry, index) => {
                  const position = index + 1
                  return (
                    <Card key={entry.id} className={`transition-all duration-200 ${getRankColor(position)}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12">
                              {getRankIcon(position)}
                            </div>
                            <div className="flex items-center space-x-2">
                              <img
                                src={entry.avatar_url || '/placeholder.svg'}
                                alt={entry.display_name}
                                className="w-10 h-10 rounded-full object-cover border-2 border-border cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setSelectedProfile({ 
                                  imageUrl: entry.avatar_url, 
                                  displayName: entry.display_name 
                                })}
                              />
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg text-foreground">{entry.display_name}</h3>
                                {activeTab === 'month' && entry.hasCompletedChallenge && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <CheckCircle className="h-5 w-5 text-green-500 cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Monthly challenge completed</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <div className="text-right">
                              <Badge variant="secondary" className="text-lg px-3 py-1 bg-muted text-foreground flex items-center gap-1">
                                <Dumbbell className="h-4 w-4" />
                                {entry.total_score}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
      </div>
      
      <ProfileImageViewer
        isOpen={!!selectedProfile}
        onClose={() => setSelectedProfile(null)}
        imageUrl={selectedProfile?.imageUrl || null}
        displayName={selectedProfile?.displayName || ''}
      />
    </div>
  )
}