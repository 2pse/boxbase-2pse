import { useState } from "react"
import { QRCodeScanner } from "./QRCodeScanner"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useDemoGuard } from "@/hooks/useDemoGuard"

interface OpenGymCheckinProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCheckinComplete: () => void
}

export const OpenGymCheckin: React.FC<OpenGymCheckinProps> = ({
  open,
  onOpenChange,
  onCheckinComplete
}) => {
  const { toast } = useToast()
  const { guardMutation } = useDemoGuard()

  const handleScanSuccess = async (result: string) => {
    if (guardMutation()) return
    // QR code successfully scanned
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({
          title: "Error",
          description: "User not authenticated",
          variant: "destructive"
        })
        return
      }

      // Process Open Gym check-in via Edge Function
      const { data: session } = await supabase.auth.getSession()
      const response = await supabase.functions.invoke('process-open-gym-checkin', {
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`
        }
      })

      if (response.error) {
        console.error('Open Gym check-in error:', response.error)
        toast({
          title: "Check-in failed",
          description: response.error.message || "An error occurred during check-in",
          variant: "destructive"
        })
        return
      }

      const result = response.data as {
        success: boolean
        message: string
        error?: string
        remainingCredits?: number
        creditsDeducted?: boolean
      }

      if (!result.success) {
        toast({
          title: "Check-in failed",
          description: result.error || "Check-in not possible",
          variant: "destructive"
        })
        return
      }

      // Success - show appropriate message
      const message = result.creditsDeducted 
        ? `Check-in successful! 1 credit deducted. Remaining: ${result.remainingCredits}`
        : result.message

      toast({
        title: "Check-in successful",
        description: message
      })

      // Dispatch event to update credits display
      window.dispatchEvent(new CustomEvent("creditsUpdated"))
      window.dispatchEvent(new CustomEvent("open-gym-checkin-success"))
      
      onCheckinComplete()
      onOpenChange(false)
    } catch (error) {
      console.error('Error during Open Gym check-in:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    }
  }

  return (
    <QRCodeScanner
      open={open}
      onOpenChange={onOpenChange}
      onScanSuccess={handleScanSuccess}
      expectedText="Open Gym Check-In"
    />
  )
}