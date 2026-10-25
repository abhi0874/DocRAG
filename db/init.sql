-- Apply only to a new, isolated DocRAG development database.
-- No DROP, DELETE, or production connection is used by this setup.
BEGIN;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS documents (
  id serial PRIMARY KEY,
  title text NOT NULL,
  filename text NOT NULL,
  page_count integer NOT NULL DEFAULT 0,
  chunk_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chunks (
  id serial PRIMARY KEY,
  document_id integer NOT NULL,
  chunk_index integer NOT NULL,
  page_number integer NOT NULL DEFAULT 1,
  content text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS metadata jsonb;
CREATE INDEX IF NOT EXISTS chunks_content_tsv_idx ON chunks USING gin(content_tsv);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING hnsw(embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks(document_id);
CREATE TABLE IF NOT EXISTS evaluations (
  id serial PRIMARY KEY,
  document_id integer NOT NULL,
  question text NOT NULL,
  rag_answer text NOT NULL,
  no_rag_answer text NOT NULL,
  retrieved_chunks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
