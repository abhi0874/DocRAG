-- Additive opt-in workspace metadata. Existing documents and vectors are unchanged.
CREATE TABLE IF NOT EXISTS workspace_document_policy (
  document_id integer PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consent_version text NOT NULL
);
CREATE INDEX IF NOT EXISTS workspace_document_expiry_idx ON workspace_document_policy(expires_at);
