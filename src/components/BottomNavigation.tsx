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
    { id: 'members' as TabType, icon: Users, label: 'Members' },
    { id: 'participants' as TabType, icon: Users, label: 'Course Participants' },
    { id: 'courses' as TabType, icon: Calendar, label: 'Courses' },
    { id: 'news' as TabType, icon: Newspaper, label: 'News' },
    { id: 'workouts' as TabType, icon: Dumbbell, label: 'Workouts' }
  ]

  // Filter out courses tab for open_gym_only users
  const availableTabs = userMembershipType === 'open_gym_only' 
    ? tabs.filter(tab => tab.id !== 'courses')
    : tabs

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-2 md:p-6 z-50 h-[72px] md:h-[110px]">
      <div className="flex justify-around max-w-md md:max-w-2xl mx-auto h-full">
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
                "flex flex-col items-center gap-1 md:gap-2 h-full py-2 md:py-3 px-3 md:px-5",
                isActive && "text-primary bg-primary/10"
              )}
            >
              <Icon className="h-5 md:h-12 w-5 md:w-12" />
              <span className="text-xs md:text-base">{tab.label}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}