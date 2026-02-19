-- Migration: Add Privy authentication support
-- Allows web users to authenticate with email via Privy
-- Privy creates embedded wallets (EVM + Solana) automatically

-- ============================================================================
-- 1. Add Privy columns to creators table
-- ============================================================================

ALTER TABLE creators
ADD COLUMN IF NOT EXISTS privy_user_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN creators.privy_user_id IS 'Privy user ID - unique identifier for web users authenticated via email';
COMMENT ON COLUMN creators.email IS 'User email address from Privy authentication';

-- ============================================================================
-- 2. Create index for Privy user ID lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_creators_privy_user_id
  ON creators(privy_user_id)
  WHERE privy_user_id IS NOT NULL;

-- ============================================================================
-- 3. Update identifier constraint to include privy_user_id
-- ============================================================================

ALTER TABLE creators DROP CONSTRAINT IF EXISTS at_least_one_identifier;

ALTER TABLE creators
ADD CONSTRAINT at_least_one_identifier CHECK (
  wallet_address IS NOT NULL
  OR evm_wallet_address IS NOT NULL
  OR farcaster_fid IS NOT NULL
  OR privy_user_id IS NOT NULL
);

COMMENT ON CONSTRAINT at_least_one_identifier ON creators IS 'Ensure at least one identifier exists: Solana wallet, EVM wallet, Farcaster FID, or Privy user ID';

-- ============================================================================
-- 4. Done
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Privy authentication support added';
  RAISE NOTICE 'Key changes:';
  RAISE NOTICE '  - Added privy_user_id (unique identifier for Privy users)';
  RAISE NOTICE '  - Added email column for user contact';
  RAISE NOTICE '  - Updated identifier constraint to accept privy_user_id';
  RAISE NOTICE '  - Web users can now authenticate via Privy email login';
END $$;
