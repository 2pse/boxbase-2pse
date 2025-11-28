import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { MoreVertical, Home, Users, Calendar, Newspaper, Dumbbell, LogOut, Moon, Sun, Trophy, DollarSign, Settings, CreditCard, Download, ShoppingBag, Mail } from "lucide-react"
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

  return (
    <header className="flex justify-between items-center w-full p-6 border-b border-border">
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
            onClick={() => setDropdownOpen(true)}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {/* Navigation Overlay */}
      {dropdownOpen && (showAdminAccess && isAdmin) && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col justify-center items-center p-8">
          <div className="grid grid-cols-3 gap-4 max-w-lg w-full">
            {/* First row */}
            <div 
              onClick={() => {
                onPageChange?.('home');
                setDropdownOpen(false);
              }}
              className={`flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors ${activePage === 'home' ? 'bg-primary/10 text-primary' : ''}`}
            >
              <Home className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Home</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('members');
                setDropdownOpen(false);
              }}
              className={`flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors ${activePage === 'members' ? 'bg-primary/10 text-primary' : ''}`}
            >
              <Users className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Members</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('memberships');
                setDropdownOpen(false);
              }}
              className={`flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors ${activePage === 'memberships' ? 'bg-primary/10 text-primary' : ''}`}
            >
              <CreditCard className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Memberships</span>
            </div>
            
            {/* Second row */}
            <div 
              onClick={() => {
                onPageChange?.('courses');
                setDropdownOpen(false);
              }}
              className={`flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors ${activePage === 'courses' ? 'bg-primary/10 text-primary' : ''}`}
            >
              <Calendar className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Courses</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('templates');
                setDropdownOpen(false);
              }}
              className={`flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors ${activePage === 'templates' ? 'bg-primary/10 text-primary' : ''}`}
            >
              <Dumbbell className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Templates</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('news');
                setDropdownOpen(false);
              }}
              className={`flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors ${activePage === 'news' ? 'bg-primary/10 text-primary' : ''}`}
            >
              <Newspaper className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">News</span>
            </div>
            
            {/* Third row */}
            <div 
              onClick={() => {
                onPageChange?.('email');
                setDropdownOpen(false);
              }}
              className={`flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors ${activePage === 'email' ? 'bg-primary/10 text-primary' : ''}`}
            >
              <Mail className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Email</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('workouts');
                setDropdownOpen(false);
              }}
              className={`flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors ${activePage === 'workouts' ? 'bg-primary/10 text-primary' : ''}`}
            >
              <Dumbbell className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Workouts</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('challenges');
                setDropdownOpen(false);
              }}
              className={`flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors ${activePage === 'challenges' ? 'bg-primary/10 text-primary' : ''}`}
            >
              <Trophy className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Challenges</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('finance');
                setDropdownOpen(false);
              }}
              className={`flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors ${activePage === 'finance' ? 'bg-primary/10 text-primary' : ''}`}
            >
              <DollarSign className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Finance</span>
            </div>
            
            {/* Fourth row */}
            <div 
              onClick={() => {
                onPageChange?.('shop');
                setDropdownOpen(false);
              }}
              className={`flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors ${activePage === 'shop' ? 'bg-primary/10 text-primary' : ''}`}
            >
              <ShoppingBag className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Shop</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('export');
                setDropdownOpen(false);
              }}
              className={`flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors ${activePage === 'export' ? 'bg-primary/10 text-primary' : ''}`}
            >
              <Download className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Backup</span>
            </div>
            <div 
              onClick={() => {
                onPageChange?.('settings');
                setDropdownOpen(false);
              }}
              className={`flex flex-col items-center justify-center p-4 rounded-lg hover:bg-hover-neutral cursor-pointer transition-colors ${activePage === 'settings' ? 'bg-primary/10 text-primary' : ''}`}
            >
              <Settings className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Settings</span>
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
    </header>
  )
}