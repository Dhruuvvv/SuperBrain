-- Enable the pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop the existing function first to allow changing the return table structure
DROP FUNCTION IF EXISTS match_reels(vector, float, int, uuid);

-- Create the match_reels function for vector similarity search
CREATE OR REPLACE FUNCTION match_reels(
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  filter_user_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  summary text,
  instagram_url text,
  author_username text,
  plain_text text,
  how_to_guide jsonb,
  similarity float,
  created_at timestamp with time zone,
  content_type text,
  tags text[],
  analysis_status text,
  thumbnail_url text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    rm.title::text,
    rm.summary::text,
    r.instagram_url::text,
    r.author_username::text,
    t.plain_text::text,
    rm.how_to_guide,
    (1 - (rm.embedding <=> query_embedding))::float AS similarity,
    r.created_at,
    rm.content_type::text,
    rm.tags::text[],
    r.analysis_status::text,
    r.thumbnail_url::text
  FROM reels r
  JOIN reel_metadata rm ON rm.reel_id = r.id
  LEFT JOIN transcripts t ON t.reel_id = r.id
  WHERE r.user_id = filter_user_id
    AND (1 - (rm.embedding <=> query_embedding)) > match_threshold
  ORDER BY rm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add mind_map column to reel_metadata to store structured mind map JSON
ALTER TABLE reel_metadata ADD COLUMN IF NOT EXISTS mind_map jsonb;

-- Create resources table for Global Resource Extraction Reliability Framework
CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid REFERENCES reels(id) ON DELETE CASCADE,
  resource_name text NOT NULL,
  resource_type text NOT NULL, -- 'Website', 'GitHub Repository', 'Documentation', 'API', 'MCP Server', 'AI Tool', 'Library', 'Database', 'Course', 'Book', 'Research Paper'
  resource_url text,
  confidence double precision DEFAULT 0.0,
  verification_status text DEFAULT 'pending_verification', -- 'pending_verification', 'verified', 'failed_verification'
  hallucination_flag boolean DEFAULT false,
  evidence_text text,
  timestamp_start text, -- SRT format e.g., '00:00:12,340'
  timestamp_end text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_resources_reel_id ON resources(reel_id);
CREATE INDEX IF NOT EXISTS idx_resources_name ON resources(resource_name);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(verification_status);
CREATE INDEX IF NOT EXISTS idx_resources_url ON resources(resource_url);

