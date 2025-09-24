-- Create a table to track read news for users
CREATE TABLE public.user_read_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  news_id UUID NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, news_id)
);

-- Enable RLS
ALTER TABLE public.user_read_news ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own read news" 
ON public.user_read_news 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own read news" 
ON public.user_read_news 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own read news" 
ON public.user_read_news 
FOR UPDATE 
USING (auth.uid() = user_id);