import { useState, useEffect } from "react"
import { Home, Calendar, Trophy, Weight, Award, Clock, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TrainingPathHeader } from "@/components/TrainingPathHeader"
import { MonthlyProgressCircle } from "@/components/MonthlyProgressCircle"
import { WeekPreview } from "@/components/WeekPreview"
import { DashboardTileGrid } from "@/components/DashboardTileGrid"
import { BottomNavigation } from "@/components/BottomNavigation"
import type { TabType as AdminTabType } from "@/components/BottomNavigation"
import { UserProfile } from "@/components/UserProfile"
import { Leaderboard } from "@/components/Leaderboard"
import { NavigationButton } from "@/components/NavigationButton"
import { WorkoutGenerator } from "@/components/WorkoutGenerator"
import { WorkoutTimer } from "@/components/WorkoutTimer"
import { ForTimeTimer } from "@/components/ForTimeTimer"
import { AmrapTimer } from "@/components/AmrapTimer"
import { EmomTimer } from "@/components/EmomTimer"
import { TabataTimer } from "@/components/TabataTimer"
import { CourseBooking } from "@/components/CourseBooking"
import { useGymSettings } from "@/contexts/GymSettingsContext"

import { LeaderboardPosition } from "@/components/LeaderboardPosition"
import ChallengeCard from "@/components/ChallengeCard"
import ChallengeDetail from "@/components/ChallengeDetail"
import { CreditsCounter } from "@/components/CreditsCounter"
import { FirstLoginDialog } from "@/components/FirstLoginDialog"

import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { useToast } from "@/hooks/use-toast"
import { useNewsNotification } from "@/hooks/useNewsNotification"
import { useRealtimeSync } from "@/hooks/useRealtimeSync"

import { useNavigate } from "react-router-dom"
import { timezone } from "@/lib/timezone"
import { PercentageCalculator } from "@/components/PercentageCalculator"
import { getPriorizedMembership } from "@/lib/membershipUtils"
import { UpcomingClassReservation } from "@/components/UpcomingClassReservation"

type DashboardTabType = 'home' | 'wod' | 'courses' | 'leaderboard' | 'news'
type WodStepType = 'selection' | 'timer-selection' | 'fortime' | 'amrap' | 'emom' | 'tabata'

interface TrainingDay {
  date: Date
  dayNumber: number
  isToday: boolean
  isFuture: boolean
  isPast: boolean
  trainingSession?: {
    type: 'course' | 'free_training' | 'plan'
    id: string
  }
  isRegisteredForCourse?: boolean
}

interface DashboardProps {
  user: User
  userRole?: string
}

export const Dashboard: React.FC<DashboardProps> = ({ user, userRole }) => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<DashboardTabType>('home')
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>([])
  const [trainingCount, setTrainingCount] = useState(0)
  const [showProfile, setShowProfile] = useState(false)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [selectedChallenge, setSelectedChallenge] = useState<{challenge: any, progress: any} | null>(null)
  const [currentChallenge, setCurrentChallenge] = useState<any>(null)
  const [wodStep, setWodStep] = useState<WodStepType>('selection')
  const [userMembershipType, setUserMembershipType] = useState<string | null>(null)
  const [showFirstLoginDialog, setShowFirstLoginDialog] = useState(false)
  const { toast } = useToast()
  const { hasUnreadNews, markNewsAsRead } = useNewsNotification(user)
  const { settings } = useGymSettings()
  
  // Check if user is Open Gym (should not see courses)
  const isOpenGym = userRole === 'open_gym' || userMembershipType === 'open_gym_only'
  
  const primaryColor = settings?.primary_color || '#B81243'

  // Setup real-time sync
  useRealtimeSync({
    user,
    onCourseRegistrationChange: () => generateTrainingDays(),
    onTrainingSessionChange: () => generateTrainingDays()
  })

  // Listen for course registration events from other components
  useEffect(() => {
    const handleCourseRegistrationChanged = () => {
      console.log('Dashboard: courseRegistrationChanged event received')
      // Delayed execution to ensure generateTrainingDays is available
      setTimeout(() => generateTrainingDays(), 0)
    }

    window.addEventListener('courseRegistrationChanged', handleCourseRegistrationChanged)
    window.addEventListener('creditsUpdated', handleCourseRegistrationChanged)
    
    return () => {
      window.removeEventListener('courseRegistrationChanged', handleCourseRegistrationChanged)
      window.removeEventListener('creditsUpdated', handleCourseRegistrationChanged)
    }
  }, [])

  // Generate training days for current month and load training sessions
  useEffect(() => {
    let mounted = true
    
    const loadData = async () => {
      if (!mounted) return
      await loadUserProfile()
      if (!mounted) return
      await generateTrainingDays()
      if (!mounted) return
      await loadCurrentChallenge()
      if (!mounted) return
      await checkFirstLogin()
    }
    
    loadData()
    
    // Check if we should open profile from navigation state
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('openProfile') === 'true') {
      setShowProfile(true)
      // Clean URL without refreshing page
      window.history.replaceState({}, '', '/pro')
    }
    
    // Listen for custom tab change events
    const handleTabChange = (event: CustomEvent) => {
      setActiveTab(event.detail as DashboardTabType)
      // Scroll to top when tab changes (except for home tab which is the overview)
      if (event.detail !== 'home') {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: 'smooth'
        })
      }
    }
    
    window.addEventListener('changeTab', handleTabChange as EventListener)
    
    return () => {
      mounted = false
      window.removeEventListener('changeTab', handleTabChange as EventListener)
    }
  }, [user.id])

  useEffect(() => {
    const handleCheckin = (e: Event) => {
      const ce = e as CustomEvent<{ date?: string; type?: string }>
      const dateStr = ce.detail?.date
      if (dateStr) {
        const d = new Date(dateStr)
        const dayNumber = d.getDate()
        let incremented = false
        setTrainingDays(prev => {
          const idx = prev.findIndex(day => day.dayNumber === dayNumber)
          if (idx === -1) return prev
          const hadSession = !!prev[idx].trainingSession
          const updated = prev.map(day =>
            day.dayNumber === dayNumber
              ? {
                  ...day,
                  trainingSession: prev[idx].trainingSession ?? {
                    type: 'free_training',
                    id: 'local'
                  }
                }
              : day
          )
          if (!hadSession) incremented = true
          return updated
        })
        if (incremented) {
          setTrainingCount(prev => prev + 1)
        }
      } else {
        // Fallback: just refresh from DB
        generateTrainingDays()
      }
      // In all cases, reconcile with DB shortly after
      setTimeout(() => generateTrainingDays(), 500)
    }
    window.addEventListener('open-gym-checkin-success', handleCheckin as EventListener)
    return () => {
      window.removeEventListener('open-gym-checkin-success', handleCheckin as EventListener)
    }
  }, [])

  const loadUserProfile = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .maybeSingle()
      
      setUserAvatar(profile?.avatar_url || null)
      
      // Load user membership type - first check V2 system, then V1
      const { data: membershipsV2 } = await supabase
        .from('user_memberships_v2')
        .select(`
          *,
          membership_plans_v2!inner(booking_rules)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (membershipsV2 && membershipsV2.length > 0) {
        // Use prioritization logic for V2 system
        const prioritizedMembership = getPriorizedMembership(membershipsV2)
        if (prioritizedMembership?.membership_plans_v2?.booking_rules) {
          const bookingRules = prioritizedMembership.membership_plans_v2.booking_rules as any
          setUserMembershipType(bookingRules.type)
          console.log('User membership type loaded (V2):', bookingRules.type)
        }
      } else {
        // V1 system deprecated - check user roles for special access  
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['admin', 'trainer'])
          .maybeSingle()

        if (userRole) {
          setUserMembershipType('unlimited')
          console.log('User membership type loaded (role-based):', 'unlimited')
        } else {
          setUserMembershipType('basic')
          console.log('User membership type: no active membership found')
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
    }
  }

  const checkFirstLogin = async () => {
    if (!user) return
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('welcome_dialog_shown')
        .eq('user_id', user.id)
        .maybeSingle()
      
      console.log('Welcome dialog check:', profile)
      
      // Show dialog if welcome dialog hasn't been shown yet
      if (!profile?.welcome_dialog_shown) {
        // Wait 2 seconds before showing the dialog
        setTimeout(() => {
          setShowFirstLoginDialog(true)
        }, 2000)
      }
    } catch (error) {
      console.error('Error checking welcome dialog status:', error)
    }
  }

  const loadCurrentChallenge = async () => {
    try {
      const currentDate = new Date()
      const currentMonth = currentDate.getMonth() + 1
      const currentYear = currentDate.getFullYear()

      const { data: challenge, error } = await supabase
        .from("monthly_challenges")
        .select("*")
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .eq("is_archived", false)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      setCurrentChallenge(challenge)
      
      // Challenge is loaded and ready
    } catch (error) {
      console.error("Error loading current challenge:", error)
    }
  }

  const generateTrainingDays = async () => {
    const today = timezone.nowInBerlin()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    
    const days: TrainingDay[] = []
    
    // Generate all days of the current month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = timezone.createDateInBerlin(currentYear, currentMonth, day)
      const isToday = timezone.isSameDayInBerlin(currentDate, today)
      const isFuture = currentDate > today
      const isPast = currentDate < today && !isToday
      
      days.push({
        date: currentDate,
        dayNumber: day,
        isToday,
        isFuture,
        isPast,
        trainingSession: undefined, // Will be filled from actual data
        isRegisteredForCourse: false // Will be set based on course registrations
      })
    }

    try {
      // Load existing training sessions
      const { data: sessions, error } = await supabase
        .from('training_sessions')
        .select('id, session_date, session_type, status')
        .eq('user_id', user.id)
        .gte('session_date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)
        .lt('session_date', `${currentYear}-${String(currentMonth + 2).padStart(2, '0')}-01`)

      if (error) {
        console.error('Error loading training sessions:', error)
        return
      }

      // Load course registrations for the month
      const { data: registrations, error: regError } = await supabase
        .from('course_registrations')
        .select(`
          course_id,
          status,
          courses(course_date, start_time, end_time)
        `)
        .eq('user_id', user.id)
        .eq('status', 'registered')
        .gte('courses.course_date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)
        .lt('courses.course_date', `${currentYear}-${String(currentMonth + 2).padStart(2, '0')}-01`)

      if (regError) {
        console.error('Error loading course registrations:', regError)
      }

      const expiredCourses = registrations?.filter(reg => {
        if (!reg.courses?.course_date || !reg.courses?.end_time) return false
        
        const courseDate = new Date(reg.courses.course_date)
        const [hours, minutes] = reg.courses.end_time.split(':').map(Number)
        const courseEndTime = new Date(courseDate)
        courseEndTime.setHours(hours, minutes, 0, 0)
        
        return courseEndTime < today
      }) || []

      for (const expiredCourse of expiredCourses) {
        if (!expiredCourse.courses?.course_date) continue
        
        const courseDate = expiredCourse.courses.course_date
        const existingSession = sessions?.find(s => s.session_date === courseDate)
        
        if (!existingSession) {
          try {
            const { error: insertError } = await supabase
              .from('training_sessions')
              .insert({
                user_id: user.id,
                session_date: courseDate,
                session_type: 'course',
                status: 'completed'
              })

            if (insertError && !insertError.message?.includes('duplicate key')) {
              console.error('Error creating training session:', insertError)
            }
          } catch (error) {
            // Silently ignore duplicate key errors
            if (!error?.message?.includes('duplicate key')) {
              console.error('Error creating training session:', error)
            }
          }
        }
      }

      // Map course registrations to days (including today and future)
      registrations?.forEach(reg => {
        if (!reg.courses?.course_date) return
        
        const courseDate = new Date(reg.courses.course_date)
        const dayNumber = courseDate.getDate()
        const dayIndex = days.findIndex(d => d.dayNumber === dayNumber)
        
        // Show green circle for any day with course registrations (today, future, or even multiple registrations)
        if (dayIndex !== -1 && (days[dayIndex].isToday || days[dayIndex].isFuture)) {
          days[dayIndex].isRegisteredForCourse = true
        }
      })

      // Map sessions to days
      sessions?.forEach(session => {
        const sessionDate = new Date(session.session_date)
        const dayNumber = sessionDate.getDate()
        const dayIndex = days.findIndex(d => d.dayNumber === dayNumber)
        
        if (dayIndex !== -1) {
          days[dayIndex].trainingSession = {
            type: session.session_type as 'course' | 'free_training' | 'plan',
            id: session.id
          }
        }
      })

      // Count unique training days for header (not individual sessions)
      const uniqueTrainingDates = new Set()
      sessions?.forEach(session => {
        if (session.status === 'completed') {
          uniqueTrainingDates.add(session.session_date)
        }
      })
      setTrainingCount(uniqueTrainingDates.size)
    } catch (error) {
      console.error('Error loading training data:', error)
    }
    
    setTrainingDays(days)
  }

  const userName = user?.user_metadata?.display_name || 
                   user?.email?.split('@')[0] || 
                   'User'

  const totalDaysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()

  const handleAddTraining = async (dayNumber: number, type: 'course' | 'free_training' | 'plan') => {
    try {
      const currentDate = timezone.nowInBerlin()
      const sessionDate = timezone.createDateInBerlin(currentDate.getFullYear(), currentDate.getMonth(), dayNumber)
      
      const { data, error } = await supabase
        .from('training_sessions')
        .insert({
          user_id: user.id,
          session_date: sessionDate.toISOString().split('T')[0],
          session_type: type,
          status: 'completed'
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving training session:', error)
        toast({
          title: "Error",
          description: "Training could not be saved.",
          variant: "destructive"
        })
        return
      }

      // Update UI
      setTrainingDays(prev => prev.map(day => 
        day.dayNumber === dayNumber 
          ? { 
              ...day, 
              trainingSession: { 
                type, 
                id: data.id
              } 
            }
          : day
      ))
      
      // Update training count
      setTrainingCount(prev => prev + 1)
      
      toast({
        title: "Training Saved",
        description: `${type === 'course' ? 'Course' : type === 'free_training' ? 'Free Training' : 'Plan'} has been successfully recorded.`
      })
    } catch (error) {
      console.error('Error adding training:', error)
      toast({
        title: "Error",
        description: "Training could not be saved.",
        variant: "destructive"
      })
    }
  }

  const handleRemoveTraining = async (dayNumber: number) => {
    try {
      const trainingDay = trainingDays.find(day => day.dayNumber === dayNumber)
      if (!trainingDay?.trainingSession) return

      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', trainingDay.trainingSession.id)

      if (error) {
        console.error('Error removing training session:', error)
        toast({
          title: "Error",
          description: "Training could not be removed.",
          variant: "destructive"
        })
        return
      }

      // Update UI
      setTrainingDays(prev => prev.map(day => 
        day.dayNumber === dayNumber 
          ? { ...day, trainingSession: undefined }
          : day
      ))
      
      // Update training count
      setTrainingCount(prev => Math.max(0, prev - 1))
      
      toast({
        title: "Training Removed",
        description: "Training has been successfully removed."
      })
    } catch (error) {
      console.error('Error removing training:', error)
      toast({
        title: "Error",
        description: "Training could not be removed.",
        variant: "destructive"
      })
    }
  }

  const handleChallengeClick = async () => {
    if (!currentChallenge) {
      await loadCurrentChallenge()
      return
    }

    try {
      // Load user progress for this challenge
      const { data: progress } = await supabase
        .from("user_challenge_progress")
        .select("*")
        .eq("challenge_id", currentChallenge.id)
        .eq("user_id", user.id)
        .maybeSingle()

      setSelectedChallenge({
        challenge: currentChallenge,
        progress: progress || {
          completed_checkpoints: 0,
          is_completed: false
        }
      })
    } catch (error) {
      console.error("Error loading challenge progress:", error)
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="flex flex-col gap-3">
            {/* Monthly Progress Circle */}
            <div className="flex items-center justify-center h-48 md:h-[400px] overflow-visible">
              <MonthlyProgressCircle 
                user={user}
                trainingCount={trainingCount}
                onDataChange={() => generateTrainingDays()}
              />
            </div>
            {/* Week Preview */}
            <div className="flex items-center w-full">
              <WeekPreview 
                user={user} 
                userRole={userRole} 
                primaryColor={primaryColor}
                userMembershipType={userMembershipType}
              />
            </div>
            {/* Upcoming Class Reservation */}
            <div className="w-full">
              {!isOpenGym && <UpcomingClassReservation user={user} />}
            </div>
            {/* Dashboard Tile Grid */}
            <div>
              <DashboardTileGrid 
                user={user}
                onChallengeClick={(challenge, progress) => {
                  setSelectedChallenge({ challenge, progress })
                }}
              />
            </div>
          </div>
        )
      case 'wod':
        const renderWodContent = () => {
          switch (wodStep) {
            case 'selection':
              return (
                <div className="flex-1">
                  <WorkoutGenerator 
                    user={user} 
                    wodStep={1} 
                    onStepChange={() => {}} 
                    onTimerSelect={(timerType) => setWodStep(timerType)}
                  />
                </div>
              )
            case 'timer-selection':
              return (
                <div className="flex-1">
                  <div className="p-4">
                    <Button
                      variant="ghost"
                      onClick={() => setWodStep('selection')}
                      className="mb-4"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  </div>
                  <WorkoutTimer 
                    embedded={true}
                    onTimerSelect={(timerType) => setWodStep(timerType)}
                  />
                </div>
              )
            case 'fortime':
              return <ForTimeTimer embedded={true} onBack={() => setWodStep('selection')} />
            case 'amrap':
              return <AmrapTimer embedded={true} onBack={() => setWodStep('selection')} />
            case 'emom':
              return <EmomTimer embedded={true} onBack={() => setWodStep('selection')} />
            case 'tabata':
              return <TabataTimer embedded={true} onBack={() => setWodStep('selection')} />
            default:
              return <WorkoutGenerator user={user} wodStep={1} onStepChange={() => {}} />
          }
        }
        
        return (
          <div className="flex-1 md:px-8 lg:px-12">
            {renderWodContent()}
          </div>
        )
      case 'courses':
        return (
          <div>
            <CourseBooking user={user} />
          </div>
        )
      case 'leaderboard':
        return (
          <div>
            <Leaderboard />
          </div>
        )
      case 'news':
        return (
          <div>
            <p className="text-center text-muted-foreground p-4">News are now available via the separate news page.</p>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b">
        <TrainingPathHeader
          trainingDaysThisMonth={trainingCount}
          totalDaysInMonth={totalDaysInMonth}
          userAvatar={userAvatar}
          onProfileClick={() => setShowProfile(true)}
          user={user}
        />
      </div>
      
      <div className="pt-16 md:pt-32 pb-20 md:pb-32 px-4 flex-1 overflow-y-auto">
        {renderTabContent()}
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-2 md:p-6 z-50 h-[72px] md:h-[108px]">
        <div className="flex justify-around max-w-md md:max-w-2xl mx-auto h-full">
          {[
            { id: 'home', icon: Home, label: 'Overview' },
            ...(isOpenGym ? [] : [{ id: 'courses', icon: Calendar, label: 'Courses' }]),
            { id: 'wod', icon: Weight, label: 'WOD' },
            { id: 'leaderboard', icon: Trophy, label: 'Leaderboard' }
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as DashboardTabType)
                  // Scroll to top when tab changes (except for home tab which is the overview)
                  if (tab.id !== 'home') {
                    window.scrollTo({
                      top: 0,
                      left: 0,
                      behavior: 'smooth'
                    })
                  }
                }}
                className={`flex flex-col items-center gap-1 md:gap-2 h-full py-2 md:py-3 px-3 md:px-5 rounded-md transition-colors ${
                  activeTab === tab.id 
                    ? 'text-primary bg-primary/10' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-hover-neutral'
                }`}
              >
                <Icon className="h-5 md:h-8 w-5 md:w-8" />
                <span className="text-xs md:text-base">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>



      {showProfile && (
        <UserProfile onClose={() => setShowProfile(false)} />
      )}
      
      {selectedChallenge && (
        <ChallengeDetail
          challenge={selectedChallenge.challenge}
          progress={selectedChallenge.progress}
          isOpen={!!selectedChallenge}
          onClose={() => setSelectedChallenge(null)}
          onProgressUpdate={() => {
            loadCurrentChallenge()
            generateTrainingDays() // Update the monthly progress circle immediately
          }}
        />
      )}

        <FirstLoginDialog 
          open={showFirstLoginDialog} 
          onClose={async () => {
            setShowFirstLoginDialog(false)
            // Mark dialog as shown in database
            try {
              await supabase
                .from('profiles')
                .update({ welcome_dialog_shown: true })
                .eq('user_id', user.id)
            } catch (error) {
              console.error('Error updating welcome dialog status:', error)
            }
          }} 
        />

        {/* Credits Counter - remove from Dashboard since it's now in TrainingPath */}
    </div>
  )
}