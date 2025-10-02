import { useState } from "react"
import { QRCodeScanner } from "./QRCodeScanner"
import { supabase } from "@/integrations/supabase/client"

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
  const handleScanSuccess = async (result: string) => {
    // QR code successfully scanned
    try {
      // Mark user as active on Open Gym check-in (real activity)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.rpc('mark_user_as_active', { user_id_param: user.id })
      }
    } catch (error) {
      console.error('Error marking user as active:', error)
    }
    
    onCheckinComplete()
    window.dispatchEvent(new CustomEvent("open-gym-checkin-success"))
    onOpenChange(false)
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