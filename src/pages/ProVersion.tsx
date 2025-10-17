import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Dashboard } from "./Dashboard"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"

const ProVersion = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    
    const handleSessionChange = (session: any) => {
      if (!mounted) return
      
      if (!session) {
        // Clear any logout flag
        localStorage.removeItem('logging_out')
        // Add small delay to prevent race conditions
        setTimeout(() => {
          if (mounted) {
            navigate("/")
          }
        }, 100)
        return
      }
      
      setUser(session.user)
      
      // Use setTimeout to defer database calls
      setTimeout(async () => {
        if (!mounted) return
        try {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle()
          
          if (mounted) {
            // Check if user is admin and redirect immediately
            if (roleData?.role === 'admin' || session.user.email === 'admin@rise-fitness.com') {
              navigate("/admin")
              return
            }
            setUserRole(roleData?.role || null)
            setLoading(false)
          }
        } catch (error) {
          console.error('Error fetching user role:', error)
          if (mounted) {
            setUserRole(null)
            setLoading(false)
          }
        }
      }, 0)
    }

    // Set up auth listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => handleSessionChange(session)
    )

    // Then check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSessionChange(session)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to auth
  }

  // Show Dashboard when authenticated
  return (
    <div className="min-h-screen h-screen bg-background pb-20 flex flex-col">
      <Dashboard user={user} userRole={userRole} />
    </div>
  )
}

export default ProVersion