# Reown AppKit Wallet Signature Implementation

## Overview

This implementation adds **automatic wallet signature prompts** to the registration flow using Reown AppKit's native APIs for both Solana and EVM chains.

## Problem

The server-side wallet verification was implemented, but users were never prompted to sign messages with their wallets during registration. This caused registration to fail with:
```
"Solana wallet signature and verification message required"
```

The previous implementation attempted to use `@solana/wallet-adapter-react` hooks which don't work with Reown AppKit's embedded/modal wallets.

## Solution

### Key Changes

1. **Removed** old wallet adapter approach (doesn't work with Reown)
2. **Added** Reown AppKit hooks:
   - `useAppKitProvider<Provider>('solana')` - Get Solana wallet provider for signing
   - `useSignMessage()` from `wagmi` - Sign messages on EVM chains

3. **Implemented** automatic signature requests:
   - When user connects wallet → prompts signature based on current network
   - When user switches networks → prompts signature for new network
   - Multi-chain detection → prompts signatures for both Solana and EVM if both detected

### Implementation Details

#### Solana Signature Flow

```typescript
const { walletProvider: solanaWalletProvider } = useAppKitProvider<Provider>('solana')

const requestSolanaSignature = async (walletAddress: string) => {
  const message = `Sign this message to verify your Solana wallet ownership for BlinkTip.\n\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`

  // Encode message and request signature via Reown AppKit
  const encodedMessage = new TextEncoder().encode(message)
  const signature = await solanaWalletProvider.signMessage(encodedMessage)
  const signatureBase64 = Buffer.from(signature).toString('base64')

  setSolanaSignature(signatureBase64)
}
```

#### EVM Signature Flow

```typescript
const { signMessageAsync: signEvmMessage } = useSignMessage()

const requestEvmSignature = async (walletAddress: string) => {
  const message = `Sign this message to verify your EVM wallet ownership for BlinkTip.\n\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`

  // Request signature via Wagmi (works with Reown AppKit)
  const signature = await signEvmMessage({ message })

  setEvmSignature(signature)
}
```

#### Automatic Triggering

Signatures are requested automatically when addresses are detected:

```typescript
useEffect(() => {
  const detectAddresses = async () => {
    // Trigger signature when Solana address detected
    if (isSolanaConnection && address && address !== solanaAddress) {
      setSolanaAddress(address)
      requestSolanaSignature(address) // ← Wallet popup appears
    }

    // Trigger signature when EVM address detected
    if (isEVMConnection && address && address !== evmAddress) {
      setEvmAddress(address)
      requestEvmSignature(address) // ← Wallet popup appears
    }
  }

  detectAddresses()
}, [address, caipNetwork])
```

## Testing Instructions

### Prerequisites
1. Have Twitter account authenticated via NextAuth
2. Have Reown AppKit configured (see `NEXT_PUBLIC_REOWN_PROJECT_ID` in `.env`)

### Test Flow

#### Test 1: Solana Wallet Only
1. Open `http://localhost:3000/register-new`
2. Click "Connect" button (Reown AppKit modal)
3. Select Phantom or Solflare wallet
4. **Expected**: Wallet popup appears asking to sign message
5. Sign the message
6. **Expected**: Form shows Solana address with signature obtained
7. Fill out registration form (slug, display name, etc.)
8. Submit form
9. **Expected**: Registration succeeds with Solana wallet

#### Test 2: EVM Wallet Only
1. Open `http://localhost:3000/register-new`
2. Click "Connect" button
3. Select MetaMask, Coinbase Wallet, or other EVM wallet
4. **Expected**: Wallet popup appears asking to sign message
5. Sign the message
6. **Expected**: Form shows EVM address with signature obtained
7. Fill out registration form
8. Submit form
9. **Expected**: Registration succeeds with EVM wallet

#### Test 3: Multi-Chain (Both Wallets)
1. Open `http://localhost:3000/register-new`
2. Connect with Solana wallet first (Phantom/Solflare)
3. **Expected**: First signature popup appears for Solana
4. Sign Solana message
5. **In Reown AppKit modal**, click network switcher and select Base Sepolia or Celo Alfajores
6. **Expected**: Second signature popup appears for EVM wallet
7. Sign EVM message
8. **Expected**: Form now shows BOTH addresses with signatures
9. Fill out registration form
10. Submit form
11. **Expected**: Registration succeeds with both wallets, `supported_chains: ['solana', 'celo']` or `['solana', 'base']`

## API Payload

The signatures are sent to `/api/creators` endpoint:

```typescript
{
  slug: string,
  wallet_address?: string,           // Solana address
  wallet_signature?: string,         // Solana signature (base64)
  verification_message?: string,     // Solana verification message
  evm_wallet_address?: string,       // EVM address
  evm_wallet_signature?: string,     // EVM signature (hex)
  evm_verification_message?: string, // EVM verification message
  // ... other registration fields
}
```

Server-side verification (already implemented):
- Solana: Uses `tweetnacl` (nacl.sign.detached.verify)
- EVM: Uses `viem` (verifyMessage)

## Files Modified

- `app/register-new/page.tsx` - Main implementation
- `app/api/creators/route.ts` - Server-side verification (already done)
- `lib/wallet-verification.ts` - Signature verification logic (already done)

## Known Issues

None currently. Wallet popups should appear immediately after connecting or switching networks.

## References

- [Reown AppKit Solana Documentation](https://docs.reown.com/appkit/recipes/solana-send-transaction)
- [Reown AppKit with Wagmi](https://docs.reown.com/appkit/react/core/installation?platform=wagmi)
- [Wagmi useSignMessage Hook](https://wagmi.sh/react/api/hooks/useSignMessage)
