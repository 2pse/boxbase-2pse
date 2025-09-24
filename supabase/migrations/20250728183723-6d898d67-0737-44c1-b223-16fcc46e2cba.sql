-- Create function for vector similarity search in workouts_rag
CREATE OR REPLACE FUNCTION match_workouts(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  workout_id uuid,
  full_text text,
  part_a_description text,
  part_b_description text,
  part_c_description text,
  part_a_type text,
  part_b_score_type text,
  part_c_score_type text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    workouts_rag.workout_id,
    workouts_rag.full_text,
    workouts_rag.part_a_description,
    workouts_rag.part_b_description,
    workouts_rag.part_c_description,
    workouts_rag.part_a_type,
    workouts_rag.part_b_score_type,
    workouts_rag.part_c_score_type,
    1 - (workouts_rag.embedding <=> query_embedding) as similarity
  FROM workouts_rag
  WHERE workouts_rag.embedding IS NOT NULL
    AND 1 - (workouts_rag.embedding <=> query_embedding) > match_threshold
  ORDER BY workouts_rag.embedding <=> query_embedding
  LIMIT match_count;
$$;