-- ============================================================================
-- DEMO DATA GENERATOR FOR OCTOBER 2025
-- 209 Members, 523 Check-ins, Revenue History
-- ============================================================================

-- Step 1: Create Membership Plans V2 (if not exists)
INSERT INTO public.membership_plans_v2 (id, name, price_monthly, duration_months, payment_frequency, booking_rules, includes_open_gym, auto_renewal, is_active, description)
VALUES
  (gen_random_uuid(), 'Unlimited', 85, 1, 'monthly', '{"type": "unlimited"}'::jsonb, true, true, true, 'Unlimited access to all classes'),
  (gen_random_uuid(), 'Limited 3x/Week', 65, 1, 'monthly', '{"type": "limited", "limit": {"count": 3, "period": "week"}}'::jsonb, true, true, true, 'Up to 3 classes per week'),
  (gen_random_uuid(), '10 Class Pass', 155, 3, 'one_time', '{"type": "credits"}'::jsonb, false, false, true, '10 classes to use within 3 months'),
  (gen_random_uuid(), 'Open Gym Only', 45, 1, 'monthly', '{"type": "open_gym_only"}'::jsonb, true, true, true, 'Open gym access only')
ON CONFLICT (name) DO NOTHING;

-- Step 2: Generate 209 fictional members
DO $$
DECLARE
  plan_unlimited_id uuid;
  plan_limited_id uuid;
  plan_credits_id uuid;
  plan_opengym_id uuid;
  
  first_names text[] := ARRAY[
    'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
    'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen',
    'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth',
    'Emily', 'Ashley', 'Kimberly', 'Donna', 'Michelle', 'Dorothy', 'Carol', 'Amanda', 'Melissa', 'Deborah',
    'Christopher', 'Kevin', 'Brian', 'George', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan',
    'Nancy', 'Betty', 'Helen', 'Sandra', 'Margaret', 'Ashley', 'Brittany', 'Rachel', 'Stephanie', 'Catherine',
    'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon',
    'Laura', 'Rebecca', 'Sharon', 'Cynthia', 'Kathleen', 'Amy', 'Angela', 'Shirley', 'Anna', 'Brenda',
    'Benjamin', 'Samuel', 'Gregory', 'Frank', 'Alexander', 'Raymond', 'Patrick', 'Jack', 'Dennis', 'Jerry',
    'Ruth', 'Diane', 'Virginia', 'Julie', 'Joyce', 'Christine', 'Alice', 'Judith', 'Marie', 'Janet',
    'Tyler', 'Aaron', 'Jose', 'Henry', 'Adam', 'Douglas', 'Nathan', 'Zachary', 'Peter', 'Kyle',
    'Katherine', 'Samantha', 'Evelyn', 'Lauren', 'Victoria', 'Grace', 'Natalie', 'Madison', 'Abigail', 'Olivia'
  ];
  
  last_names text[] := ARRAY[
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
    'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
    'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
    'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
    'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
    'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
    'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
    'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez'
  ];

  user_id uuid;
  first_name text;
  last_name text;
  nickname text;
  membership_plan_id uuid;
  start_date date;
  remaining_credits integer;
  plan_price numeric;
  plan_booking_type text;
  plan_name text;
  
  i integer;
  member_count integer := 209;
BEGIN
  -- Get plan IDs
  SELECT id INTO plan_unlimited_id FROM public.membership_plans_v2 WHERE name = 'Unlimited' LIMIT 1;
  SELECT id INTO plan_limited_id FROM public.membership_plans_v2 WHERE name = 'Limited 3x/Week' LIMIT 1;
  SELECT id INTO plan_credits_id FROM public.membership_plans_v2 WHERE name = '10 Class Pass' LIMIT 1;
  SELECT id INTO plan_opengym_id FROM public.membership_plans_v2 WHERE name = 'Open Gym Only' LIMIT 1;

  -- Generate 209 members
  FOR i IN 1..member_count LOOP
    user_id := gen_random_uuid();
    first_name := first_names[1 + floor(random() * array_length(first_names, 1))::int];
    last_name := last_names[1 + floor(random() * array_length(last_names, 1))::int];
    nickname := CASE 
      WHEN random() < 0.3 THEN lower(substring(first_name, 1, 1) || last_name)
      ELSE NULL
    END;
    
    -- Distribute membership plans: 40% Unlimited, 30% Limited, 20% Credits, 10% Open Gym
    IF random() < 0.4 THEN
      membership_plan_id := plan_unlimited_id;
      remaining_credits := NULL;
      plan_price := 85;
      plan_booking_type := 'unlimited';
      plan_name := 'Unlimited';
    ELSIF random() < 0.7 THEN
      membership_plan_id := plan_limited_id;
      remaining_credits := 3 + floor(random() * 10)::int; -- 3-12 credits
      plan_price := 65;
      plan_booking_type := 'limited';
      plan_name := 'Limited 3x/Week';
    ELSIF random() < 0.9 THEN
      membership_plan_id := plan_credits_id;
      remaining_credits := 2 + floor(random() * 9)::int; -- 2-10 credits
      plan_price := 155;
      plan_booking_type := 'credits';
      plan_name := '10 Class Pass';
    ELSE
      membership_plan_id := plan_opengym_id;
      remaining_credits := NULL;
      plan_price := 45;
      plan_booking_type := 'open_gym_only';
      plan_name := 'Open Gym Only';
    END IF;

    -- Start dates: August-October 2025
    start_date := '2025-08-01'::date + (floor(random() * 90)::int || ' days')::interval;

    -- Insert profile
    INSERT INTO public.profiles (
      user_id, 
      first_name, 
      last_name, 
      display_name,
      nickname,
      access_code,
      status,
      leaderboard_visible,
      back_squat_1rm,
      front_squat_1rm,
      deadlift_1rm,
      bench_press_1rm,
      snatch_1rm,
      clean_1rm,
      jerk_1rm,
      clean_and_jerk_1rm
    ) VALUES (
      user_id,
      first_name,
      last_name,
      first_name || ' ' || last_name,
      nickname,
      upper(substring(md5(random()::text), 1, 6)),
      CASE WHEN random() < 0.9 THEN 'active' ELSE 'inactive' END,
      random() < 0.85,
      60 + floor(random() * 140)::int,  -- 60-200kg
      50 + floor(random() * 100)::int,  -- 50-150kg
      80 + floor(random() * 180)::int,  -- 80-260kg
      40 + floor(random() * 120)::int,  -- 40-160kg
      30 + floor(random() * 70)::int,   -- 30-100kg
      40 + floor(random() * 90)::int,   -- 40-130kg
      35 + floor(random() * 75)::int,   -- 35-110kg
      45 + floor(random() * 95)::int    -- 45-140kg
    );

    -- Insert user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_id, 'member');

    -- Insert membership
    INSERT INTO public.user_memberships_v2 (
      user_id,
      membership_plan_id,
      start_date,
      end_date,
      status,
      auto_renewal,
      membership_data
    ) VALUES (
      user_id,
      membership_plan_id,
      start_date,
      CASE 
        WHEN plan_booking_type = 'credits' THEN start_date + interval '3 months'
        ELSE start_date + interval '1 month'
      END,
      'active',
      plan_booking_type != 'credits',
      jsonb_build_object(
        'remaining_credits', remaining_credits,
        'initial_credits', CASE WHEN plan_booking_type = 'credits' THEN 10 ELSE remaining_credits END
      )
    );

    -- Insert revenue history for October
    IF start_date <= '2025-10-31'::date THEN
      INSERT INTO public.revenue_history (
        user_id,
        membership_plan_id,
        membership_plan_name,
        amount,
        period_start,
        period_end,
        booking_type
      ) VALUES (
        user_id,
        membership_plan_id,
        plan_name,
        plan_price,
        '2025-10-01'::date,
        '2025-10-31'::date,
        plan_booking_type
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Created % members with memberships and revenue history', member_count;
END $$;

-- Step 3: Generate 523 training sessions for October 2025
DO $$
DECLARE
  user_ids uuid[];
  selected_user_id uuid;
  session_date date;
  session_types text[] := ARRAY['CrossFit WOD', 'Open Gym', 'Strength', 'Olympic Lifting', 'Gymnastics'];
  session_type text;
  i integer;
  session_count integer := 523;
  weekday integer;
BEGIN
  -- Get all active user IDs
  SELECT ARRAY_AGG(user_id) INTO user_ids 
  FROM public.profiles 
  WHERE status = 'active';

  -- Generate 523 sessions
  FOR i IN 1..session_count LOOP
    -- Random date in October 2025, weighted towards weekdays
    session_date := '2025-10-01'::date + floor(random() * 31)::int;
    weekday := EXTRACT(DOW FROM session_date);
    
    -- Re-roll weekend dates (reduce weekend sessions)
    IF weekday IN (0, 6) AND random() < 0.6 THEN
      session_date := '2025-10-01'::date + floor(random() * 31)::int;
    END IF;

    -- Select random user
    selected_user_id := user_ids[1 + floor(random() * array_length(user_ids, 1))::int];
    
    -- Select random session type
    session_type := session_types[1 + floor(random() * array_length(session_types, 1))::int];

    -- Insert training session
    INSERT INTO public.training_sessions (
      user_id,
      session_date,
      session_type,
      status,
      duration_minutes,
      completed_at,
      workout_data
    ) VALUES (
      selected_user_id,
      session_date,
      session_type,
      'completed',
      45 + floor(random() * 45)::int,  -- 45-90 minutes
      (session_date::timestamp + ((8 + floor(random() * 12)::int) || ' hours')::interval + (floor(random() * 60)::int || ' minutes')::interval),
      jsonb_build_object(
        'wod_type', session_type,
        'notes', 'Demo training session',
        'rpe', 6 + floor(random() * 4)::int
      )
    );
  END LOOP;

  RAISE NOTICE 'Created % training sessions for October 2025', session_count;
END $$;

-- Summary
DO $$
DECLARE
  total_members integer;
  total_sessions integer;
  total_revenue numeric;
  active_unlimited integer;
  active_limited integer;
  active_credits integer;
  active_opengym integer;
BEGIN
  SELECT COUNT(*) INTO total_members FROM public.profiles;
  SELECT COUNT(*) INTO total_sessions FROM public.training_sessions WHERE session_date >= '2025-10-01' AND session_date <= '2025-10-31';
  SELECT COALESCE(SUM(amount), 0) INTO total_revenue FROM public.revenue_history WHERE period_start = '2025-10-01';
  
  SELECT COUNT(*) INTO active_unlimited 
  FROM public.user_memberships_v2 um
  JOIN public.membership_plans_v2 mp ON um.membership_plan_id = mp.id
  WHERE mp.name = 'Unlimited' AND um.status = 'active';
  
  SELECT COUNT(*) INTO active_limited 
  FROM public.user_memberships_v2 um
  JOIN public.membership_plans_v2 mp ON um.membership_plan_id = mp.id
  WHERE mp.name = 'Limited 3x/Week' AND um.status = 'active';
  
  SELECT COUNT(*) INTO active_credits 
  FROM public.user_memberships_v2 um
  JOIN public.membership_plans_v2 mp ON um.membership_plan_id = mp.id
  WHERE mp.name = '10 Class Pass' AND um.status = 'active';
  
  SELECT COUNT(*) INTO active_opengym 
  FROM public.user_memberships_v2 um
  JOIN public.membership_plans_v2 mp ON um.membership_plan_id = mp.id
  WHERE mp.name = 'Open Gym Only' AND um.status = 'active';

  RAISE NOTICE '============================================';
  RAISE NOTICE 'DEMO DATA GENERATION COMPLETE';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total Members: %', total_members;
  RAISE NOTICE 'Total Training Sessions (October): %', total_sessions;
  RAISE NOTICE 'Total Revenue (October): €%', total_revenue;
  RAISE NOTICE '--------------------------------------------';
  RAISE NOTICE 'Membership Distribution:';
  RAISE NOTICE '  - Unlimited (€85): %', active_unlimited;
  RAISE NOTICE '  - Limited 3x/Week (€65): %', active_limited;
  RAISE NOTICE '  - 10 Class Pass (€155): %', active_credits;
  RAISE NOTICE '  - Open Gym Only (€45): %', active_opengym;
  RAISE NOTICE '============================================';
END $$;
