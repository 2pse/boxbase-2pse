import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Logo } from "./Logo"
import { Grid3X3, Home, Users, Calendar, Trophy, BarChart3, Settings, LogOut, Sun, Moon, Crown, Award, Zap, Flame, CreditCard, Dumbbell, Newspaper, DollarSign, User } from "lucide-react"
import { useTheme } from "next-themes"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { LeaderboardPosition } from "./LeaderboardPosition"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface TrainingPathHeaderProps {
  trainingDaysThisMonth: number;
  totalDaysInMonth: number;
  userAvatar?: string | null;
  onProfileClick: () => void;
  onLogout?: () => void;
  user: SupabaseUser; // For leaderboard position
}

export const TrainingPathHeader: React.FC<TrainingPathHeaderProps> = ({
  trainingDaysThisMonth,
  totalDaysInMonth,
  userAvatar,
  onProfileClick,
  onLogout,
  user
}) => {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // Check admin role
  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Special handling for admin email
        if (user.email === 'admin@rise-fitness.com') {
          setIsAdmin(true)
          return
        }

        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .single()

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking admin role:', error)
          setIsAdmin(false)
        } else {
          setIsAdmin(!!data)
        }
      } catch (error) {
        console.error('Error checking admin role:', error)
        setIsAdmin(false)
      }
    }

    checkAdminRole()
  }, [])

  const handleLogout = async () => {
    if (onLogout) {
      onLogout()
    }
    setDropdownOpen(false)
  }

  return (
    <div className="flex items-center justify-between p-3 md:p-5 bg-background border-b">
      {/* Left side - Avatar */}
      <div className="flex-1">
        <Avatar className="h-8 md:h-13 w-8 md:w-13 cursor-pointer hover:ring-2 hover:ring-primary transition-all" onClick={onProfileClick}>
          <AvatarImage src={userAvatar} />
          <AvatarFallback>
            <User className="h-4 md:h-6 w-4 md:w-6" />
          </AvatarFallback>
        </Avatar>
      </div>
      
      {/* Center - Logo */}
      <div className="flex-1 flex justify-center">
        <Logo 
          className="h-10 md:h-16 mt-1"
          onClick={() => window.location.href = '/pro'}
        />
      </div>
      
      {/* Right side - Leaderboard Position */}
      <div className="flex items-center gap-2 md:gap-4 flex-1 justify-end">
        {/* Leaderboard Position - Only show for users who opted in */}
        <LeaderboardPosition user={user} />

        {/* Admin Access */}
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="p-2 md:p-2 hover:bg-primary/10"
          >
            <Grid3X3 className="h-4 md:h-6 w-4 md:w-6 text-primary" />
          </Button>
        )}
      </div>

      {/* Admin Navigation Overlay */}
      {dropdownOpen && isAdmin && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col justify-center items-center p-8">
          <div className="grid grid-cols-3 gap-4 max-w-lg w-full">
            {/* First row */}
            <div 
              onClick={() => {
                navigate('/admin');
                setDropdownOpen(false);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors"
            >
              <Home className="h-8 w-8 text-foreground mb-2" />
              <span className="text-sm font-medium text-foreground">Home</span>
            </div>
            <div 
              onClick={() => {
                navigate('/admin');
                setDropdownOpen(false);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors"
            >
              <Users className="h-8 w-8 text-foreground mb-2" />
              <span className="text-sm font-medium text-foreground">Members</span>
            </div>
            <div 
              onClick={() => {
                navigate('/admin');
                setDropdownOpen(false);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors"
            >
              <CreditCard className="h-8 w-8 text-foreground mb-2" />
              <span className="text-sm font-medium text-foreground">Mitgliedschaften</span>
            </div>
            
            {/* Second row */}
            <div 
              onClick={() => {
                navigate('/admin');
                setDropdownOpen(false);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors"
            >
              <Calendar className="h-8 w-8 text-foreground mb-2" />
              <span className="text-sm font-medium text-foreground">Courses</span>
            </div>
            <div 
              onClick={() => {
                navigate('/admin');
                setDropdownOpen(false);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors"
            >
              <Dumbbell className="h-8 w-8 text-foreground mb-2" />
              <span className="text-sm font-medium text-foreground">Vorlagen</span>
            </div>
            <div 
              onClick={() => {
                navigate('/admin');
                setDropdownOpen(false);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors"
            >
              <Newspaper className="h-8 w-8 text-foreground mb-2" />
              <span className="text-sm font-medium text-foreground">News</span>
            </div>
            
            {/* Third row */}
            <div 
              onClick={() => {
                navigate('/workout-management');
                setDropdownOpen(false);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors"
            >
              <Dumbbell className="h-8 w-8 text-foreground mb-2" />
              <span className="text-sm font-medium text-foreground">Workouts</span>
            </div>
            <div 
              onClick={() => {
                navigate('/admin');
                setDropdownOpen(false);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors"
            >
              <Trophy className="h-8 w-8 text-foreground mb-2" />
              <span className="text-sm font-medium text-foreground">Challenges</span>
            </div>
            <div 
              onClick={() => {
                navigate('/admin');
                setDropdownOpen(false);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors"
            >
              <DollarSign className="h-8 w-8 text-foreground mb-2" />
              <span className="text-sm font-medium text-foreground">Finance</span>
            </div>
            
            {/* Fourth row */}
            <div 
              onClick={() => {
                navigate('/admin');
                setDropdownOpen(false);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors"
            >
              <Settings className="h-8 w-8 text-foreground mb-2" />
              <span className="text-sm font-medium text-foreground">Einstellungen</span>
            </div>
            
            {onLogout && (
              <div 
                onClick={handleLogout}
                className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-destructive/10 cursor-pointer transition-colors"
              >
                <LogOut className="h-8 w-8 text-destructive mb-2" />
                <span className="text-sm font-medium text-destructive">Log out</span>
              </div>
            )}
          </div>
          
          {/* Close button */}
          <div className="absolute top-6 right-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDropdownOpen(false)}
            >
              <span className="text-xl">×</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}