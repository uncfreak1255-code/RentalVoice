-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE voice_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id TEXT,
  guest_message TEXT NOT NULL,
  host_response TEXT NOT NULL,
  intent TEXT,
  origin_type TEXT DEFAULT 'historical', -- historical | host_written | ai_approved | ai_edited
  hostaway_conversation_id TEXT,
  message_hash TEXT, -- SHA-256 of guest_message + host_response for dedup
  embedding VECTOR(768) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  source_date TIMESTAMPTZ -- historical imports: message timestamp; continuous learning: now()
);

-- HNSW index: no reindexing needed, better recall at 2k-5k scale
CREATE INDEX voice_examples_embedding_idx
  ON voice_examples USING hnsw (embedding vector_cosine_ops);

CREATE INDEX voice_examples_property_idx
  ON voice_examples (org_id, property_id);

-- UNIQUE index for ON CONFLICT upsert dedup.
-- COALESCE handles NULL hostaway_conversation_id so uniqueness works for non-Hostaway examples too.
CREATE UNIQUE INDEX voice_examples_dedup_idx
  ON voice_examples (org_id, COALESCE(hostaway_conversation_id, ''), message_hash);

-- RLS: matches existing org_members subquery pattern
ALTER TABLE voice_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY voice_examples_org ON voice_examples
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- RPC function for pgvector similarity search
CREATE OR REPLACE FUNCTION match_voice_examples(
  query_embedding VECTOR(768),
  query_org_id UUID,
  query_property_id TEXT DEFAULT NULL,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  guest_message TEXT,
  host_response TEXT,
  intent TEXT,
  origin_type TEXT,
  property_id TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ve.guest_message,
    ve.host_response,
    ve.intent,
    ve.origin_type,
    ve.property_id,
    1 - (ve.embedding <=> query_embedding) AS similarity
  FROM voice_examples ve
  WHERE ve.org_id = query_org_id
    AND (query_property_id IS NULL OR ve.property_id = query_property_id OR ve.property_id IS NULL)
  ORDER BY ve.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
