-- Update the database function to also dispatch webhook events after processing waitlists
CREATE OR REPLACE FUNCTION process_waitlists_on_cancellation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result_process jsonb;
    result_dispatch jsonb;
BEGIN
    -- Call the process-waitlists function
    SELECT content::jsonb INTO result_process
    FROM http((
        'POST',
        current_setting('app.settings.supabase_url') || '/functions/v1/process-waitlists',
        ARRAY[
            http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
            http_header('Content-Type', 'application/json')
        ],
        '{}'::text
    ));
    
    -- Call the dispatch function to send webhook events
    SELECT content::jsonb INTO result_dispatch
    FROM http((
        'POST',
        current_setting('app.settings.supabase_url') || '/functions/v1/dispatch-waitlist-promotion-events',
        ARRAY[
            http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
            http_header('Content-Type', 'application/json')
        ],
        '{}'::text
    ));
    
    -- Log the results for debugging
    RAISE NOTICE 'Process waitlists result: %', result_process;
    RAISE NOTICE 'Dispatch events result: %', result_dispatch;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        RAISE WARNING 'Error in process_waitlists_on_cancellation: %', SQLERRM;
END;
$$;