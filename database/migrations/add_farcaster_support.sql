-- Migration: Add Farcaster FID support for mini app integration
-- Allows users to have one profile across Base App and Farcaster clients
-- with different wallets (Base Smart Account + Farcaster wallet)

-- ============================================================================
-- 1. Add Farcaster columns to creators table
-- ============================================================================

ALTER TABLE creators
ADD COLUMN IF NOT EXISTS farcaster_fid BIGINT UNIQUE,
ADD COLUMN IF NOT EXISTS farcaster_username TEXT,
ADD COLUMN IF NOT EXISTS farcaster_verified BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN creators.farcaster_fid IS 'Farcaster ID - unique identifier shared across Base App and Farcaster clients';
COMMENT ON COLUMN creators.farcaster_username IS 'Farcaster username (without @ prefix)';
COMMENT ON COLUMN creators.farcaster_verified IS 'Whether the Farcaster account has been verified';

-- ============================================================================
-- 2. Create index for FID lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_creators_farcaster_fid ON creators(farcaster_fid) WHERE farcaster_fid IS NOT NULL;

-- ============================================================================
-- 3. Make wallet_address unique constraint conditional
-- ============================================================================

-- Drop old unique constraint on wallet_address if it exists
ALTER TABLE creators DROP CONSTRAINT IF EXISTS creators_wallet_address_key;

-- Add partial unique constraints (only enforce uniqueness when value is not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_creators_wallet_address_unique
  ON creators(wallet_address)
  WHERE wallet_address IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_creators_evm_wallet_address_unique
  ON creators(evm_wallet_address)
  WHERE evm_wallet_address IS NOT NULL;

-- ============================================================================
-- 4. Update at_least_one_wallet constraint to include FID
-- ============================================================================

ALTER TABLE creators DROP CONSTRAINT IF EXISTS at_least_one_wallet;

ALTER TABLE creators
ADD CONSTRAINT at_least_one_identifier CHECK (
  wallet_address IS NOT NULL
  OR evm_wallet_address IS NOT NULL
  OR farcaster_fid IS NOT NULL
);

COMMENT ON CONSTRAINT at_least_one_identifier ON creators IS 'Ensure at least one identifier exists: Solana wallet, EVM wallet, or Farcaster FID';

-- ============================================================================
-- 5. Done
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Farcaster support added';
  RAISE NOTICE 'Key changes:';
  RAISE NOTICE '  - Added farcaster_fid (unique identifier)';
  RAISE NOTICE '  - Added farcaster_username and farcaster_verified';
  RAISE NOTICE '  - Users can now have multiple wallets per FID';
  RAISE NOTICE '  - Prevents duplicate profiles across Base App and Farcaster';
END $$;
