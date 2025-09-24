-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the waitlist processing job to run every 5 minutes
SELECT cron.schedule(
  'process-waitlists-job',
  '*/5 * * * *', -- every 5 minutes
  $$
  SELECT
    net.http_post(
        url:='https://vdpeyaphtsbrhygupfbc.supabase.co/functions/v1/process-waitlists',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkcGV5YXBodHNicmh5Z3VwZmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MzA1NTQsImV4cCI6MjA2OTIwNjU1NH0.di1zDFbMIYpX-FNsSshaf4q-OMW8SpLqYM5SToltcCI"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);