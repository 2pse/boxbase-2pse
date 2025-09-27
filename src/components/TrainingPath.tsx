import { TrainingPathNode } from "./TrainingPathNode"
import { TrainingSessionDialog } from "./TrainingSessionDialog"
import { DayCourseDialog } from "./DayCourseDialog"
import { MonthlyTrainingCalendar } from "./MonthlyTrainingCalendar"

import { WhatsAppButton } from "./WhatsAppButton"
import { EmailButton } from "./EmailButton"
import { CreditsCounter } from "./CreditsCounter"
import { Button } from "@/components/ui/button"
import { Newspaper } from "lucide-react"
import { useNewsNotification } from "@/hooks/useNewsNotification"
import { useState, useEffect, useRef } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useNavigate } from "react-router-dom"
import { getPriorizedMembership, getMembershipTypeName } from "@/lib/membershipUtils"
import { useRealtimeSync } from "@/hooks/useRealtimeSync"

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

interface TrainingPathProps {
  trainingDays: TrainingDay[]
  onAddTraining: (dayNumber: number, type: 'course' | 'free_training' | 'plan') => void
  onRemoveTraining: (dayNumber: number) => void
  user: any
  userRole?: string
  onDataChange?: () => void
}

export const TrainingPath: React.FC<TrainingPathProps> = ({ 
  trainingDays, 
  onAddTraining, 
  onRemoveTraining,
  user,
  userRole,
  onDataChange
}) => {
  const [selectedDay, setSelectedDay] = useState<TrainingDay | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [showDayCourses, setShowDayCourses] = useState(false)
  const [userMembershipType, setUserMembershipType] = useState<string | null>(null)
  const [includesOpenGym, setIncludesOpenGym] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const todayRef = useRef<HTMLDivElement>(null)
  const { hasUnreadNews, markNewsAsRead } = useNewsNotification(user)
  const navigate = useNavigate()

  // Setup real-time sync
  useRealtimeSync({
    user,
    onCourseRegistrationChange: onDataChange,
    onTrainingSessionChange: onDataChange
  })

  // Auto-scroll to today on mount and when trainingDays change
  useEffect(() => {
    const scrollToToday = () => {
      const todayElement = todayRef.current
      const container = containerRef.current
      
      if (!todayElement || !container) {
        return
      }

      // Use scrollIntoView for more reliable scrolling
      todayElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      })
    }

    // Enhanced scroll logic with multiple attempts and better timing
    if (trainingDays.length > 0) {
      // Immediate attempt
      const immediateTimer = setTimeout(scrollToToday, 50)
      
      // After DOM update
      const domTimer = setTimeout(scrollToToday, 200)
      
      // After layout calculations
      const layoutTimer = setTimeout(scrollToToday, 500)
      
      // Final fallback with longer delay
      const fallbackTimer = setTimeout(scrollToToday, 1000)

      // Use ResizeObserver to handle dynamic content sizing
      const resizeObserver = new ResizeObserver(() => {
        setTimeout(scrollToToday, 100)
      })

      if (containerRef.current) {
        resizeObserver.observe(containerRef.current)
      }

      // Cleanup function
      return () => {
        clearTimeout(immediateTimer)
        clearTimeout(domTimer)
        clearTimeout(layoutTimer)
        clearTimeout(fallbackTimer)
        resizeObserver.disconnect()
      }
    }
  }, [trainingDays])

  // Additional effect to scroll when component first mounts
  useEffect(() => {
    const scrollToTodayOnMount = () => {
      const todayElement = todayRef.current
      
      if (todayElement) {
        todayElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        })
      }
    }

    // Scroll when the component first loads and today element is available
    const mountTimer = setTimeout(scrollToTodayOnMount, 100)
    
    return () => clearTimeout(mountTimer)
  }, [])

  // Load user membership type and open gym access
  useEffect(() => {
    const loadUserMembershipType = async () => {
      try {
        // First, try V2 membership system
        const { data: membershipV2Data } = await supabase
          .from('user_memberships_v2')
          .select(`
            status,
            membership_data,
            membership_plans_v2(
              name,
              booking_rules,
              includes_open_gym
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')

        let membershipType = '';
        let hasOpenGymAccess = false;
        let isOpenGymOnly = false;

        if (membershipV2Data && membershipV2Data.length > 0) {
          // Use V2 system with prioritization
          const prioritizedMembership = getPriorizedMembership(membershipV2Data);
          const bookingType = prioritizedMembership?.membership_plans_v2?.booking_rules?.type;
          const membershipPlan = prioritizedMembership?.membership_plans_v2 as any;
          
          membershipType = getMembershipTypeName(prioritizedMembership, null);
          // Check the actual includes_open_gym field from the database
          hasOpenGymAccess = membershipPlan?.includes_open_gym === true;
          isOpenGymOnly = bookingType === 'open_gym_only';
        } else {
          // V1 system deprecated - check user roles for special access
          const { data: userRole } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .in('role', ['admin', 'trainer'])
            .maybeSingle()

          if (userRole) {
            membershipType = 'unlimited'
            hasOpenGymAccess = true
            isOpenGymOnly = false
          } else {
            // Final fallback to legacy profile system
            const { data: profileData } = await supabase
              .from('profiles')
              .select('membership_type')
              .eq('user_id', user.id)
              .single()
            membershipType = profileData?.membership_type || 'Basic Member'
            hasOpenGymAccess = membershipType !== 'Credits'
            isOpenGymOnly = false
          }
        }

        console.log('User membership loaded:', { membershipType, hasOpenGymAccess, isOpenGymOnly });
        setUserMembershipType(isOpenGymOnly ? 'open_gym_only' : membershipType);
        setIncludesOpenGym(hasOpenGymAccess);
      } catch (error) {
        console.error('Error loading user membership type:', error)
        setUserMembershipType('Basic Member')
        setIncludesOpenGym(false)
      }
    }

    if (user?.id) {
      loadUserMembershipType()
    }
  }, [user.id])

  const currentMonth = new Date().toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  })

  const handleDayClick = (day: TrainingDay) => {
    // Vergangene Tage können nicht angeklickt werden
    if (!day.isToday && !day.isFuture) {
      return
    }
    
    setSelectedDay(day)
    
    // Für open_gym_only Mitgliedschaften zeige nur den Training Dialog (kein Kurse Dialog)
    if (userMembershipType === 'open_gym_only') {
      setShowDialog(true)
    } else {
      setShowDayCourses(true)
    }
  }

  const handleSelectType = (type: 'course' | 'free_training' | 'plan' | 'remove') => {
    if (!selectedDay) return
    
    if (type === 'remove') {
      onRemoveTraining(selectedDay.dayNumber)
    } else {
      onAddTraining(selectedDay.dayNumber, type)
    }
  }

  const getNodeStatus = (day: TrainingDay) => {
    if (day.trainingSession) return 'completed'
    if (day.isToday) return 'current'
    if (day.isFuture) return 'locked' // Zukünftige Tage sind grau
    return 'pending'
  }


  return (
    <div className="flex-1 flex flex-col relative">
      {/* Fixierte Überschrift */}
      <div className="text-center p-4 bg-background">
        <h2 className="text-xl font-bold text-foreground">
          {currentMonth}
        </h2>
      </div>

      {/* Scrollbarer Trainingsbereich */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-gradient-to-b from-background to-muted/20">
        <div className="flex flex-col items-center py-8 pb-24 max-w-md mx-auto">
          {trainingDays.map((day, index) => (
            <div 
              key={day.dayNumber} 
              className="flex flex-col items-center"
              ref={day.isToday ? todayRef : null}
            >
              <TrainingPathNode
                id={day.dayNumber.toString()}
                date={day.date}
                status={getNodeStatus(day)}
                workoutType={day.trainingSession?.type}
                dayNumber={day.dayNumber}
                onSelectWorkout={day.isToday || day.isFuture ? () => handleDayClick(day) : undefined}
                isRegisteredForCourse={day.isRegisteredForCourse || false}
              />
              
              {/* Verbindungslinie zum nächsten Tag */}
              {index < trainingDays.length - 1 && (
                <div className="w-1 h-12 bg-border my-2 shadow-[2px_0_8px_rgba(0,0,0,0.15)] dark:shadow-[2px_0_8px_rgba(255,255,255,0.1)]" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fixierte Elemente */}
      {/* Links: Monatliche Trainingskalender - fixiert */}
      <div className="fixed left-4 top-1/2 transform -translate-y-1/2 z-30">
        <MonthlyTrainingCalendar user={user} userRole={userRole} />
      </div>

      <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-3">
        <Button
           variant="outline"
           size="icon"
           onClick={() => {
             navigate('/news')
             markNewsAsRead()
           }}
           className="rounded-full w-14 h-14 border-2 border-foreground/20 bg-background/90 backdrop-blur-sm hover:bg-foreground/10 shadow-lg relative"
           aria-label="Aktuelles anzeigen"
         >
           <Newspaper className="h-4 w-4" />
          {hasUnreadNews && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              1
            </div>
          )}
        </Button>
        
        <CreditsCounter user={user} />
        
        <EmailButton />
        <WhatsAppButton />
      </div>

      {/* Dialog für Training-Auswahl */}
      <TrainingSessionDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        date={selectedDay?.date || new Date()}
        dayNumber={selectedDay?.dayNumber || 0}
        onSelectType={handleSelectType}
        hasExistingSession={!!selectedDay?.trainingSession}
        userMembershipType={userMembershipType}
        includesOpenGym={includesOpenGym}
      />

      {/* Dialog für Tages-Kurse */}
      <DayCourseDialog
        open={showDayCourses}
        onOpenChange={setShowDayCourses}
        date={selectedDay ? `${selectedDay.date.getFullYear()}-${String(selectedDay.date.getMonth() + 1).padStart(2, '0')}-${String(selectedDay.date.getDate()).padStart(2, '0')}` : ''}
        user={user}
        userRole={userRole}
      />

    </div>
  )
}