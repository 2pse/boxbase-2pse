import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Logo } from "@/components/Logo";

export default function Auth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    let hasRedirected = false;
    
    const handleRedirect = async (session: Session | null) => {
      if (!session?.user || hasRedirected || !mounted) return;
      
      hasRedirected = true;
      
      // Use setTimeout to defer navigation and database calls
      setTimeout(async () => {
        if (!mounted) return;
        
        try {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .eq('role', 'admin')
            .maybeSingle();

          if (!mounted) return;

          if (roleData || session.user.email === 'fitness@app.com') {
            navigate("/admin");
          } else {
            navigate("/pro");
          }
        } catch (error) {
          console.error('Error checking user role:', error);
          if (mounted) {
            navigate("/pro");
          }
        }
      }, 100);
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_IN') {
          handleRedirect(session);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        handleRedirect(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!email || !accessCode) {
        toast.error("Please enter email and access code");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: accessCode,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or access code");
        } else {
          toast.error(error.message);
        }
        return;
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login error");
    } finally {
      setLoading(false);
    }
  };


  if (user) {
    return null; // User will be redirected
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mb-4">
              <Logo className="h-12 mx-auto" />
            </div>
            <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Access Code"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.replace(/\s/g, ''))}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-[1.02]" 
                disabled={loading}
              >
                {loading ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}