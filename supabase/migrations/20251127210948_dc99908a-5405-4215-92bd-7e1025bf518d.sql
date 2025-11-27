-- Table: course_invitations
CREATE TABLE public.course_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'declined'))
);

-- Enable RLS
ALTER TABLE public.course_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for course_invitations
CREATE POLICY "Users can view invitations they sent or received"
  ON public.course_invitations FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can insert their own invitations"
  ON public.course_invitations FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can update their invitations"
  ON public.course_invitations FOR UPDATE
  USING (auth.uid() = recipient_id);

-- Table: member_favorites
CREATE TABLE public.member_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  favorite_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, favorite_user_id)
);

-- Enable RLS
ALTER TABLE public.member_favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policy for member_favorites
CREATE POLICY "Users can manage their own favorites"
  ON public.member_favorites FOR ALL
  USING (auth.uid() = user_id);

-- Add webhook_invitation_url to gym_settings
ALTER TABLE public.gym_settings 
ADD COLUMN IF NOT EXISTS webhook_invitation_url TEXT;