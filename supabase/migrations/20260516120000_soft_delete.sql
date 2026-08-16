-- Soft delete for documents (trash / restore)

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS documents_deleted_at_idx
  ON documents (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_active_owner_idx
  ON documents (owner_id, updated_at DESC)
  WHERE deleted_at IS NULL;
