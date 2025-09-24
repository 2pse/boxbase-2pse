-- Update the webhook URL with the actual Make.com webhook
-- Replace the placeholder with the real webhook URL once configured
CREATE OR REPLACE FUNCTION public.process_waitlists_with_notification()
RETURNS TRIGGER AS $$
DECLARE
  course_rec RECORD;
  waitlist_rec RECORD;
  current_registered_count INTEGER;
  webhook_url TEXT;
  webhook_payload JSONB;
  http_request_id BIGINT;
BEGIN
  -- Only handle when status changes from registered/waitlist to cancelled
  IF OLD.status IN ('registered', 'waitlist') AND NEW.status = 'cancelled' THEN
    -- Get webhook URL from Supabase secret (you'll need to configure this)
    -- For now using a placeholder - update this with your actual Make.com webhook
    webhook_url := 'https://hook.eu2.make.com/placeholder-update-me';
    
    BEGIN
      -- Fetch course details
      SELECT * INTO course_rec FROM public.courses WHERE id = NEW.course_id;

      IF FOUND THEN
        -- Count current registered participants
        SELECT COUNT(*) INTO current_registered_count
        FROM public.course_registrations
        WHERE course_id = NEW.course_id AND status = 'registered';

        -- If spot available and waitlist exists, promote earliest waitlisted user
        IF current_registered_count < course_rec.max_participants THEN
          SELECT cr.*, p.display_name, p.user_id as profile_user_id
          INTO waitlist_rec
          FROM public.course_registrations cr
          LEFT JOIN public.profiles p ON cr.user_id = p.user_id
          WHERE cr.course_id = NEW.course_id AND cr.status = 'waitlist'
          ORDER BY cr.registered_at ASC
          LIMIT 1;

          IF FOUND THEN
            -- Promote from waitlist to registered
            UPDATE public.course_registrations
            SET status = 'registered',
                updated_at = now()
            WHERE id = waitlist_rec.id;

            -- Log the promotion event
            INSERT INTO public.waitlist_promotion_events (
              registration_id, 
              course_id, 
              user_id, 
              payload,
              notified_at
            ) VALUES (
              waitlist_rec.id,
              NEW.course_id,
              waitlist_rec.user_id,
              jsonb_build_object(
                'event_type', 'waitlist_promoted',
                'course_id', NEW.course_id,
                'course_title', course_rec.title,
                'course_date', course_rec.course_date,
                'course_time', course_rec.start_time,
                'registration_id', waitlist_rec.id,
                'user_id', waitlist_rec.user_id,
                'user_name', waitlist_rec.display_name,
                'promotion_type', 'automatic_on_cancellation',
                'promoted_at', now()
              ),
              now()
            );

            -- Prepare webhook payload for Make.com
            webhook_payload := jsonb_build_object(
              'event_type', 'waitlist_promotion',
              'course', jsonb_build_object(
                'id', course_rec.id,
                'title', course_rec.title,
                'date', course_rec.course_date,
                'time', course_rec.start_time,
                'trainer', course_rec.trainer
              ),
              'user', jsonb_build_object(
                'id', waitlist_rec.user_id,
                'name', waitlist_rec.display_name
              ),
              'registration_id', waitlist_rec.id,
              'promoted_at', now()
            );

            -- Send webhook notification to Make.com (with error handling)
            -- Only send if webhook URL is configured properly
            IF webhook_url != 'https://hook.eu2.make.com/placeholder-update-me' THEN
              BEGIN
                SELECT net.http_post(
                  url := webhook_url,
                  headers := '{"Content-Type":"application/json"}'::jsonb,
                  body := webhook_payload::text
                ) INTO http_request_id;
                
                RAISE LOG 'Webhook sent for waitlist promotion: user_id=%, course_id=%', waitlist_rec.user_id, NEW.course_id;
              EXCEPTION WHEN OTHERS THEN
                -- Log webhook failure but don't rollback the promotion
                RAISE WARNING 'Failed to send webhook for waitlist promotion: %', SQLERRM;
              END;
            ELSE
              RAISE LOG 'Webhook URL not configured - skipping notification for waitlist promotion: user_id=%, course_id=%', waitlist_rec.user_id, NEW.course_id;
            END IF;
          END IF;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log but do not rollback promotion
      RAISE WARNING 'Error processing waitlist: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';