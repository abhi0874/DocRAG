-- Only the separate, empty docrag_demo_gemini_v1 database. Never apply to local vectors.
CREATE TABLE demo_embedding_space (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  version text NOT NULL,
  model text NOT NULL,
  dimensions integer NOT NULL,
  corpus_hash text NOT NULL
);
-- The bootstrap inserts the single readiness row only after every vector is stored.
