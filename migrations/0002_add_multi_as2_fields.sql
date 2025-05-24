-- Add AS2 fields to partners table for single bucket with prefixes
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS as2_server_id TEXT,
ADD COLUMN IF NOT EXISTS s3_prefix TEXT;

-- Add index for active AS2 receivers
CREATE INDEX IF NOT EXISTS idx_partners_active_as2_receivers 
ON partners(is_active, transport_type, as2_server_id) 
WHERE is_active = true AND transport_type = 'AS2' AND as2_server_id IS NOT NULL;

-- Add comment explaining the prefix structure
COMMENT ON COLUMN partners.s3_prefix IS 'S3 prefix for this receiver, e.g., "receivers/partner-gln/". If null, will be auto-generated from GLN or partner ID.';