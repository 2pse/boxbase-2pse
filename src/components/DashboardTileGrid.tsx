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
    <div className="h-full flex flex-col gap-3">
      <div style={{ height: '50%' }}>
        <DashboardChallengeCard 
          user={user} 
          onChallengeClick={onChallengeClick}
        />
      </div>
      <div className="grid grid-cols-2 gap-2" style={{ height: '50%' }}>
        <DashboardNewsCard user={user} />
        <DashboardCreditsCard user={user} />
      </div>
    </div>
  )
}