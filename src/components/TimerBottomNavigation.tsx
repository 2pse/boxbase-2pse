import { Home, Calendar, Trophy, Weight } from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"

export const TimerBottomNavigation: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const tabs = [
    { id: 'uebersicht', icon: Home, label: 'Overview', route: '/pro' },
    { id: 'courses', icon: Calendar, label: 'Courses', route: '/pro' },
    { id: 'wod', icon: Weight, label: 'Workout', route: '/workout-timer' },
    { id: 'leaderboard', icon: Trophy, label: 'Leaderboard', route: '/pro' }
  ]

  const getActiveTab = () => {
    if (location.pathname.includes('/workout-timer')) return 'wod'
    if (location.pathname === '/pro') return 'uebersicht'
    return 'uebersicht'
  }

  const activeTab = getActiveTab()

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-2 md:p-3 z-50 h-[72px] md:h-[100px]">
      <div className="flex justify-around max-w-md md:max-w-2xl mx-auto h-full">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.route)}
              className={`flex flex-col items-center gap-1 md:gap-2 h-full py-2 md:py-3 px-3 md:px-4 rounded-md transition-colors ${
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-hover-neutral'
              }`}
            >
              <Icon className="h-5 w-5 md:h-[32px] md:w-[32px]" />
              <span className="text-xs md:text-sm font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}