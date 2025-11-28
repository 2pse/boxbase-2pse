import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { 
  MoreVertical, 
  Home, 
  Users, 
  Calendar, 
  Newspaper, 
  Dumbbell, 
  LogOut, 
  Moon, 
  Sun, 
  Trophy, 
  DollarSign, 
  Settings, 
  CreditCard, 
  Download, 
  ShoppingBag, 
  Mail, 
  Activity, 
  Layers 
} from "lucide-react"
import { useTheme } from "next-themes"
import { supabase } from "@/integrations/supabase/client"
import { Logo } from "@/components/Logo"
import { useGymSettings } from "@/contexts/GymSettingsContext"

interface RiseHeaderProps {
  showNavigation?: boolean
  onLogout?: () => void
  showAdminAccess?: boolean
  activePage?: string
  onPageChange?: (page: string) => void
}

export const RiseHeader: React.FC<RiseHeaderProps> = ({ 
  showNavigation = false,
  onLogout,
  showAdminAccess = false,
  activePage,
  onPageChange
}) => {
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const { theme, setTheme } = useTheme()
  const { settings } = useGymSettings()

  // Theme switcher is always available
  const isThemeEnforced = false

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
          .maybeSingle()

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

    if (showAdminAccess) {
      checkAdminRole()
    }
  }, [showAdminAccess])

  const handleLogout = async () => {
    try {
      // Set logout flag to prevent AuthKeeper interference
      localStorage.setItem('logging_out', 'true')
      setDropdownOpen(false)
      
      // Clear local storage immediately
      localStorage.removeItem('mockUser')
      localStorage.removeItem('lastAppRefresh')
      
      try {
        // Attempt proper logout
        await supabase.auth.signOut()
      } catch (authError: any) {
        // Handle session already invalid gracefully
        console.log('Session already invalid or logout failed:', authError)
      }

      // Clear logout flag
      localStorage.removeItem('logging_out')

      // Call parent logout if provided
      if (onLogout) {
        onLogout()
      }
      
      // Navigate to home as fallback
      navigate('/')
    } catch (error) {
      console.error('Error during logout:', error)
      // Clear logout flag
      localStorage.removeItem('logging_out')
      // Fallback: still call parent and navigate
      setDropdownOpen(false)
      if (onLogout) {
        onLogout()
      }
      navigate('/')
    }
  }

  const navItemBaseClass = "w-full flex flex-col items-center justify-center p-6 rounded-xl cursor-pointer transition-all duration-300 border border-border/50 hover:bg-muted/50 hover:scale-105 hover:border-primary/30 hover:shadow-lg"
  const navItemActiveClass = "bg-primary/10 text-primary border-primary/50 shadow-md"

  return (
    <header className="relative z-50 flex justify-between items-center w-full p-6 border-b border-border">
      <div className="flex items-center gap-4">
        <Logo 
          className="h-12"
          onClick={() => navigate('/')}
        />
      </div>
      
      <div className="flex items-center gap-2">
        {/* Dark Mode Toggle - only show for non-enforced themes and all authenticated users */}
        {!isThemeEnforced && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="hover:bg-hover-neutral"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        )}
        
        {(showAdminAccess && isAdmin) && (
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            {dropdownOpen ? <span className="text-xl">×</span> : <MoreVertical className="h-4 w-4" />}
          </Button>
        )}
      </div>
      
      {/* Navigation Overlay */}
      {dropdownOpen && (showAdminAccess && isAdmin) && (
        <div className="fixed inset-x-0 top-[88px] bottom-0 z-40 bg-background/95 backdrop-blur-sm flex flex-col items-center p-8 overflow-y-auto">
          <div className="grid grid-cols-3 gap-6 max-w-3xl w-full my-auto justify-items-center">
            {/* Row 1: Home, Members, Memberships */}
            <div 
              onClick={() => {
                onPageChange?.('home');
                setDropdownOpen(false);
              }}
              className={`${navItemBaseClass} ${activePage === 'home' ? navItemActiveClass : ''}`}
            >
              <Home className="h-10 w-10 mb-3" />
              <span className="text-sm font-semibold">Home</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('members');
                setDropdownOpen(false);
              }}
              className={`${navItemBaseClass} ${activePage === 'members' ? navItemActiveClass : ''}`}
            >
              <Users className="h-10 w-10 mb-3" />
              <span className="text-sm font-semibold">Members</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('memberships');
                setDropdownOpen(false);
              }}
              className={`${navItemBaseClass} ${activePage === 'memberships' ? navItemActiveClass : ''}`}
            >
              <CreditCard className="h-10 w-10 mb-3" />
              <span className="text-sm font-semibold text-center leading-tight">Member-<br />ships</span>
            </div>
            
            {/* Row 2: Courses, Templates, News */}
            <div 
              onClick={() => {
                onPageChange?.('courses');
                setDropdownOpen(false);
              }}
              className={`${navItemBaseClass} ${activePage === 'courses' ? navItemActiveClass : ''}`}
            >
              <Calendar className="h-10 w-10 mb-3" />
              <span className="text-sm font-semibold">Courses</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('templates');
                setDropdownOpen(false);
              }}
              className={`${navItemBaseClass} ${activePage === 'templates' ? navItemActiveClass : ''}`}
            >
              <Layers className="h-10 w-10 mb-3" />
              <span className="text-sm font-semibold">Templates</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('news');
                setDropdownOpen(false);
              }}
              className={`${navItemBaseClass} ${activePage === 'news' ? navItemActiveClass : ''}`}
            >
              <Newspaper className="h-10 w-10 mb-3" />
              <span className="text-sm font-semibold">News</span>
            </div>
            
            {/* Row 3: Workouts, Challenges, Finance */}
            <div 
              onClick={() => {
                onPageChange?.('workouts');
                setDropdownOpen(false);
              }}
              className={`${navItemBaseClass} ${activePage === 'workouts' ? navItemActiveClass : ''}`}
            >
              <Dumbbell className="h-10 w-10 mb-3" />
              <span className="text-sm font-semibold">Workouts</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('challenges');
                setDropdownOpen(false);
              }}
              className={`${navItemBaseClass} ${activePage === 'challenges' ? navItemActiveClass : ''}`}
            >
              <Trophy className="h-10 w-10 mb-3" />
              <span className="text-sm font-semibold">Challenges</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('finance');
                setDropdownOpen(false);
              }}
              className={`${navItemBaseClass} ${activePage === 'finance' ? navItemActiveClass : ''}`}
            >
              <DollarSign className="h-10 w-10 mb-3" />
              <span className="text-sm font-semibold">Finance</span>
            </div>
            
            {/* Row 4: Shop, Emails, Risk Radar */}
            <div 
              onClick={() => {
                onPageChange?.('shop');
                setDropdownOpen(false);
              }}
              className={`${navItemBaseClass} ${activePage === 'shop' ? navItemActiveClass : ''}`}
            >
              <ShoppingBag className="h-10 w-10 mb-3" />
              <span className="text-sm font-semibold">Shop</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('email');
                setDropdownOpen(false);
              }}
              className={`${navItemBaseClass} ${activePage === 'email' ? navItemActiveClass : ''}`}
            >
              <Mail className="h-10 w-10 mb-3" />
              <span className="text-sm font-semibold">Emails</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('risk-radar');
                setDropdownOpen(false);
              }}
              className={`${navItemBaseClass} ${activePage === 'risk-radar' ? navItemActiveClass : ''}`}
            >
              <Activity className="h-10 w-10 mb-3" />
              <span className="text-sm font-semibold">Risk Radar</span>
            </div>
            
            {/* Row 5: Data Export, Settings, Log out */}
            <div 
              onClick={() => {
                onPageChange?.('export');
                setDropdownOpen(false);
              }}
              className={`${navItemBaseClass} ${activePage === 'export' ? navItemActiveClass : ''}`}
            >
              <Download className="h-10 w-10 mb-3" />
              <span className="text-sm font-semibold">Data Export</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('settings');
                setDropdownOpen(false);
              }}
              className={`${navItemBaseClass} ${activePage === 'settings' ? navItemActiveClass : ''}`}
            >
              <Settings className="h-10 w-10 mb-3" />
              <span className="text-sm font-semibold">Settings</span>
            </div>
            
            {onLogout && (
              <div 
                onClick={handleLogout}
                className="w-full flex flex-col items-center justify-center p-6 rounded-xl cursor-pointer transition-all duration-300 border border-border/50 hover:bg-destructive/10 hover:scale-105 hover:border-destructive/30 hover:shadow-lg"
              >
                <LogOut className="h-10 w-10 text-destructive mb-3" />
                <span className="text-sm font-semibold text-destructive">Log out</span>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
