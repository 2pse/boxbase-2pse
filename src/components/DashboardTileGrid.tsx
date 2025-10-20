import { User } from "@supabase/supabase-js"
import { DashboardChallengeCard } from "./DashboardChallengeCard"
import { DashboardNewsCard } from "./DashboardNewsCard"
import { DashboardCreditsCard } from "./DashboardCreditsCard"

interface DashboardTileGridProps {
  user: User
  onChallengeClick?: (challenge: any, progress: any) => void
}

export const DashboardTileGrid: React.FC<DashboardTileGridProps> = ({
  user,
  onChallengeClick
}) => {
  return (
    <div className="min-h-[1000px] md:min-h-[1200px] lg:h-full flex flex-col gap-5 md:gap-7 md:px-8 lg:px-12">
      <div style={{ height: 'calc(50% - 12px)' }}>
        <DashboardChallengeCard 
          user={user} 
          onChallengeClick={onChallengeClick}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 md:gap-5" style={{ height: 'calc(50% - 12px)' }}>
        <DashboardNewsCard user={user} />
        <DashboardCreditsCard user={user} />
      </div>
    </div>
  )
}