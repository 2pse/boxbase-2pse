import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { TimerBottomNavigation } from "@/components/TimerBottomNavigation"
import { ArrowLeft } from "lucide-react"
import { useGymSettings } from "@/contexts/GymSettingsContext"

interface WorkoutTimerProps {
  embedded?: boolean
}

export const WorkoutTimer: React.FC<WorkoutTimerProps> = ({ embedded = false }) => {
  const navigate = useNavigate()
  const { settings } = useGymSettings()
  const primaryColor = settings?.primary_color || '#B81243'

  const timerTypes = [
    { id: 'fortime', title: 'For Time', route: '/workout-timer/fortime' },
    { id: 'amrap', title: 'AMRAP', route: '/workout-timer/amrap' },
    { id: 'emom', title: 'EMOM', route: '/workout-timer/emom' },
    { id: 'tabata', title: 'TABATA', route: '/workout-timer/tabata' }
  ]

  if (embedded) {
    return (
      <div className="bg-background">
        <div className="p-6">
          <div className="max-w-md w-full mx-auto">
            <div className="text-center mb-4">
              <h1 className="text-6xl font-bold mb-1">WOD</h1>
              <h2 className="text-2xl text-muted-foreground">Timer</h2>
            </div>

            <div className="space-y-6">
              {timerTypes.map((type) => (
                <Button
                  key={type.id}
                  variant="outline"
                  onClick={() => navigate(type.route)}
                  className="w-full h-20 text-2xl border-2 bg-background hover:text-white rounded-2xl font-medium transition-all duration-200"
                  style={{
                    borderColor: primaryColor,
                    color: primaryColor
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = primaryColor
                    e.currentTarget.style.color = 'white'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = primaryColor
                  }}
                >
                  {type.title}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="p-4">
        <Button
          variant="ghost"
          onClick={() => {
            // Always navigate back to WOD tab
            navigate('/pro')
            // Trigger tab change to WOD immediately
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('changeTab', { detail: 'wod' }))
            }, 50)
            // Clear the referrer
            sessionStorage.removeItem('timer-referrer')
          }}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-6 pb-20">
        <div className="max-w-md w-full">
          <div className="text-center mb-4">
            <h1 className="text-6xl font-bold mb-1">WOD</h1>
            <h2 className="text-2xl text-muted-foreground">Timer</h2>
          </div>

          <div className="space-y-6">
            {timerTypes.map((type) => (
              <Button
                key={type.id}
                variant="outline"
                onClick={() => navigate(type.route)}
                className="w-full h-20 text-2xl border-2 bg-background hover:text-white rounded-2xl font-medium transition-all duration-200"
                style={{
                  borderColor: primaryColor,
                  color: primaryColor
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = primaryColor
                  e.currentTarget.style.color = 'white'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = primaryColor
                }}
              >
                {type.title}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <TimerBottomNavigation />
    </div>
  )
}