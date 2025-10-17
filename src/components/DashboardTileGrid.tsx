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
    <div className="h-full md:h-screen md:pb-32 flex flex-col gap-3 md:gap-6">
      <div className="md:flex-1" style={{ height: 'calc(50% - 6px)' }}>
        <DashboardChallengeCard 
          user={user} 
          onChallengeClick={onChallengeClick}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 md:gap-4 md:flex-1" style={{ height: 'calc(50% - 6px)' }}>
        <DashboardNewsCard user={user} />
        <DashboardCreditsCard user={user} />
      </div>
    </div>
  )
}