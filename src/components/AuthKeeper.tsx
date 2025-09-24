import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Keeps Supabase sessions alive and rehydrates on app visibility changes
export const AuthKeeper = () => {
  useEffect(() => {
    // Subscribe to auth state to ensure library timers are active
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      // no-op: just ensuring listener is attached
    });

    const ensureSession = async () => {
      try {
        // Check if user is currently logging out
        const isLoggingOut = localStorage.getItem('logging_out')
        if (isLoggingOut) {
          return // Skip session refresh during logout
        }
        
        // Triggers rehydration and refresh timers if needed
        const { data: { session } } = await supabase.auth.getSession();
        
        // If no session, user might be logged out - don't spam refresh
        if (!session) {
          return
        }
      } catch (e: any) {
        // Handle session errors gracefully
        if (e?.message?.includes('session_not_found') || e?.status === 403) {
          // Session is invalid, don't retry
          return
        }
        // Silently ignore other errors to avoid noisy logs
      }
    };

    // Initial ensure
    ensureSession();

    // Refresh when app returns to foreground
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        ensureSession();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Periodic keep-alive well below 1h JWT expiry
    const interval = setInterval(ensureSession, 1000 * 60 * 20); // every 20 minutes

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
};

