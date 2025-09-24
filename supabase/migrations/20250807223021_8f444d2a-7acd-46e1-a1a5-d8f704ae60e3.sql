-- Add RLS policies for waitlist_promotion_events table to fix security warning
CREATE POLICY "Admins can manage waitlist promotion events" 
ON public.waitlist_promotion_events 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert waitlist promotion events" 
ON public.waitlist_promotion_events 
FOR INSERT 
WITH CHECK (true);