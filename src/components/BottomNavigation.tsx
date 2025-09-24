import { Users, Calendar, Newspaper, Settings, Dumbbell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type TabType = 'members' | 'participants' | 'courses' | 'news' | 'workouts'

interface BottomNavigationProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  userMembershipType?: string | null
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
  userMembershipType
}) => {
  const tabs = [
    { id: 'members' as TabType, icon: Users, label: 'Mitglieder' },
    { id: 'participants' as TabType, icon: Users, label: 'Kurs-Teilnehmer' },
    { id: 'courses' as TabType, icon: Calendar, label: 'Kurse anlegen' },
    { id: 'news' as TabType, icon: Newspaper, label: 'Aktuelles' },
    { id: 'workouts' as TabType, icon: Dumbbell, label: 'Workouts' }
  ]

  // Filter out courses tab for open_gym_only users
  const availableTabs = userMembershipType === 'open_gym_only' 
    ? tabs.filter(tab => tab.id !== 'courses')
    : tabs

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-2 z-50">
      <div className="flex justify-around max-w-md mx-auto">
        {availableTabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          
          return (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 h-auto py-2 px-3",
                isActive && "text-primary bg-primary/10"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{tab.label}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}