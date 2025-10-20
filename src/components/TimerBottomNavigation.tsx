import { Home, Calendar, Users, Trophy, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useNavigate, useLocation } from "react-router-dom"

export const TimerBottomNavigation: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const tabs = [
    { id: 'uebersicht', icon: Home, label: 'Overview', route: '/pro' },
    { id: 'wod', icon: Timer, label: 'WOD', route: '/workout-timer' },
    { id: 'courses', icon: Calendar, label: 'Courses', route: '/pro' },
    { id: 'leaderboard', icon: Trophy, label: 'Leaderboard', route: '/pro' }
  ]

  const getActiveTab = () => {
    if (location.pathname.includes('/workout-timer')) return 'wod'
    if (location.pathname === '/pro') return 'uebersicht'
    return 'uebersicht'
  }

  const activeTab = getActiveTab()

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-2 z-50 h-[72px]">
      <div className="flex justify-around max-w-md md:max-w-2xl mx-auto h-full">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          
          return (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              onClick={() => navigate(tab.route)}
              className={cn(
                "flex flex-col items-center gap-1 h-full py-2 px-3",
                isActive && "text-primary bg-primary/10"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{tab.label}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}