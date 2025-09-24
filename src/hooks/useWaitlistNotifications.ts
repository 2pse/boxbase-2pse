import { useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export const useWaitlistNotifications = () => {
  useEffect(() => {
    const processUnnotifiedEvents = async () => {
      try {
        // Check if user is admin
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single()

        if (userRole?.role !== 'admin') return

        // Get unnotified promotion events
        const { data: events, error } = await supabase
          .from('waitlist_promotion_events')
          .select('id, registration_id')
          .is('notified_at', null)
          .order('created_at', { ascending: true })
          .limit(10)

        if (error) {
          console.error('Error fetching unnotified events:', error)
          return
        }

        if (!events || events.length === 0) return

        console.log(`Processing ${events.length} unnotified waitlist events`)

        // Process each event
        for (const event of events) {
          try {
            // Call the notification edge function
            const { error: notifyError } = await supabase.functions.invoke('notify-waitlist-promotion', {
              body: { registration_id: event.registration_id }
            })

            if (notifyError) {
              console.error('Notify error for event', event.id, ':', notifyError)
              continue
            }

            // Mark as notified
            const { error: updateError } = await supabase
              .from('waitlist_promotion_events')
              .update({ notified_at: new Date().toISOString() })
              .eq('id', event.id)

            if (updateError) {
              console.error('Update error for event', event.id, ':', updateError)
            } else {
              console.log('Successfully notified waitlist promotion for event', event.id)
            }

          } catch (err) {
            console.error('Exception processing event', event.id, ':', err)
          }
        }

      } catch (error) {
        console.error('Error processing waitlist notifications:', error)
      }
    }

    // Process immediately
    processUnnotifiedEvents()

    // Set up interval to check every 30 seconds
    const interval = setInterval(processUnnotifiedEvents, 30000)

    // Set up realtime subscription for new waitlist promotion events
    const channel = supabase
      .channel('waitlist-promotions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'waitlist_promotion_events'
        },
        (payload) => {
          console.log('New waitlist promotion event:', payload)
          // Process the new event immediately
          setTimeout(processUnnotifiedEvents, 1000)
        }
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [])
}