# BlinkTip API Security Fix Checklist

## Critical Fixes - MUST COMPLETE BEFORE PRODUCTION (2 days max)

### 1. Protect Agent Run Endpoint
**File:** `app/api/agent/run/route.ts`  
**Estimated Time:** 30 minutes  
**Impact:** Prevents wallet draining attacks

- [ ] Uncomment authentication check at line 23-26
- [ ] Verify `AGENT_API_SECRET` environment variable is set
- [ ] Test with: `curl -X POST http://localhost:3000/api/agent/run` (should return 401)
- [ ] Test with auth: `curl -H "Authorization: Bearer $AGENT_API_SECRET" -X POST http://localhost:3000/api/agent/run` (should work)

**Code Change:**
```typescript
// UNCOMMENT THIS CODE:
const authHeader = request.headers.get("authorization");
if (authHeader !== `Bearer ${process.env.AGENT_API_SECRET}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

---

### 2. Protect Creator Registration
**File:** `app/api/creators/route.ts`  
**Estimated Time:** 2 hours  
**Impact:** Prevents creator impersonation attacks

**Phase 2A: Add Session Requirement (30 min)**
- [ ] Add NextAuth import
- [ ] Require session at start of POST handler
- [ ] Test that unauthenticated requests return 401

```typescript
// Add this at top of POST function:
const session = await getServerSession(authOptions);
if (!session?.user?.twitterId) {
  return NextResponse.json(
    { error: "Unauthorized - Please sign in first" },
    { status: 401 }
  );
}
```

**Phase 2B: Add Wallet Validation (1 hour)**
- [ ] Create `isValidSolanaAddress()` utility function
- [ ] Validate wallet address format before database insert
- [ ] Verify wallet isn't already used by another creator
- [ ] Add field length validation for name, bio, avatar_url

```typescript
// Add validator function:
function isValidSolanaAddress(address: string): boolean {
  try {
    const decoded = bs58.decode(address);
    return decoded.length === 32;
  } catch {
    return false;
  }
}

// Use in validation:
if (!isValidSolanaAddress(body.wallet_address)) {
  return NextResponse.json(
    { error: "Invalid Solana wallet address" },
    { status: 400 }
  );
}
```

**Phase 2C: Add Wallet Signature Verification (30 min)**
- [ ] (Optional for MVP) Require signed message proving wallet ownership
- [ ] Verify signature before creating creator

---

### 3. Protect Tip Confirmation
**File:** `app/api/tips/confirm/route.ts`  
**Estimated Time:** 1 hour  
**Impact:** Prevents fraudulent tip confirmations

- [ ] Add NextAuth session requirement
- [ ] Validate `from_address` matches session user's wallet
- [ ] Verify signature is valid
- [ ] Test that unauthorized requests return 401

```typescript
// Add at start of POST:
const session = await getServerSession(authOptions);
if (!session?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Validate from_address matches user
if (!isValidSolanaAddress(body.from_address)) {
  return NextResponse.json({ error: "Invalid address" }, { status: 400 });
}
```

---

### 4. Validate Payment Amounts
**File:** `app/api/x402/tip/[slug]/pay-solana/route.ts`  
**Estimated Time:** 1.5 hours  
**Impact:** Prevents payment system abuse

**Add Amount Validation:**
- [ ] Validate amount parameter is provided
- [ ] Check amount is positive number
- [ ] Check amount is within reasonable range (0.01 - 100)
- [ ] Check decimal precision (max 6 decimals for USDC)
- [ ] Sanitize all metadata fields (agent_id, content_url, content_title)

```typescript
// Replace lines 39-40 with:
const amountParam = url.searchParams.get('amount');
if (!amountParam) {
  return NextResponse.json(
    { error: "amount parameter required" },
    { status: 400 }
  );
}

const amount = parseFloat(amountParam);
if (isNaN(amount) || amount <= 0 || amount > 100) {
  return NextResponse.json(
    { error: "Invalid tip amount (must be 0 < amount ≤ 100)" },
    { status: 400 }
  );
}

// Check decimal places (USDC = 6 decimals)
const decimalPlaces = amountParam.split('.')[1]?.length || 0;
if (decimalPlaces > 6) {
  return NextResponse.json(
    { error: "Amount has too many decimal places" },
    { status: 400 }
  );
}
```

**Sanitize Metadata:**
- [ ] Limit agent_id length
- [ ] Validate content_url is valid URL
- [ ] Limit content_title length, remove HTML/scripts

```typescript
// Add sanitization:
const agentId = (url.searchParams.get('agent_id') || 'unknown').slice(0, 100);
const contentUrl = (url.searchParams.get('content_url') || 'unknown').slice(0, 500);
const contentTitle = (url.searchParams.get('content_title') || '').slice(0, 200);

// Validate content_url format
if (!contentUrl.includes('unknown')) {
  try {
    new URL(contentUrl);
  } catch {
    return NextResponse.json(
      { error: "Invalid content_url" },
      { status: 400 }
    );
  }
}
```

**Also apply to:** `app/api/x402/fund-agent/route.ts` (line 97-98)

---

### 5. Implement Rate Limiting
**Estimated Time:** 2-3 hours  
**Impact:** Prevents DoS attacks and wallet draining

**Step 1: Install Upstash Ratelimit**
```bash
npm install @upstash/ratelimit @upstash/redis
```

**Step 2: Create Rate Limit Utility**
**File:** `lib/ratelimit.ts`

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Create rate limiters for different endpoints
export const rateLimiters = {
  agentRun: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(1, "1 m"), // 1 per minute
    analytics: true,
  }),
  creatorCreate: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, "1 d"), // 5 per day per user
    analytics: true,
  }),
  tipConfirm: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 per minute
    analytics: true,
  }),
  x402Fund: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, "1 m"), // 5 per minute
    analytics: true,
  }),
};

export async function checkRateLimit(
  limiter: any,
  key: string
): Promise<boolean> {
  const { success } = await limiter.limit(key);
  return success;
}
```

**Step 3: Apply Rate Limiting to Endpoints**

**In `/api/agent/run/route.ts`:**
```typescript
import { checkRateLimit, rateLimiters } from "@/lib/ratelimit";

export async function POST(request: NextRequest) {
  const ip = request.ip || request.headers.get("x-forwarded-for") || "unknown";
  
  // Check rate limit
  const allowed = await checkRateLimit(rateLimiters.agentRun, `agent-run:${ip}`);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 1 run per minute." },
      { status: 429 }
    );
  }
  
  // ... rest of handler
}
```

**In `/api/creators/route.ts`:**
```typescript
import { checkRateLimit, rateLimiters } from "@/lib/ratelimit";

export async function POST(request: NextRequest) {
  const ip = request.ip || request.headers.get("x-forwarded-for") || "unknown";
  const userId = session?.user?.id || ip;
  
  // Check rate limit
  const allowed = await checkRateLimit(
    rateLimiters.creatorCreate,
    `creator-create:${userId}`
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 5 creator registrations per day." },
      { status: 429 }
    );
  }
  
  // ... rest of handler
}
```

**In `/api/tips/confirm/route.ts`:**
```typescript
const allowed = await checkRateLimit(
  rateLimiters.tipConfirm,
  `tip-confirm:${body.from_address}`
);
if (!allowed) {
  return NextResponse.json(
    { error: "Rate limit exceeded" },
    { status: 429 }
  );
}
```

**In `/api/x402/fund-agent/route.ts`:**
```typescript
const allowed = await checkRateLimit(
  rateLimiters.x402Fund,
  `x402-fund:${ip}`
);
if (!allowed) {
  return NextResponse.json(
    { error: "Rate limit exceeded" },
    { status: 429 }
  );
}
```

**Add to Environment Variables:**
```
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

- [ ] Create Upstash account: https://upstash.com
- [ ] Create Redis database
- [ ] Copy REST URL and token to environment
- [ ] Install packages
- [ ] Create rate limit utility
- [ ] Apply to all 5 critical endpoints
- [ ] Test rate limiting works

---

### 6. Rotate All Exposed Secrets
**Estimated Time:** 30 minutes + waiting for verification  
**Impact:** Prevents unauthorized access to infrastructure

**Secrets to Rotate:**
- [ ] `CDP_API_KEY_SECRET` - Regenerate in Coinbase
- [ ] `CDP_WALLET_SECRET` - Regenerate in Coinbase  
- [ ] `NEXTAUTH_SECRET` - Run: `openssl rand -base64 32`
- [ ] `TWITTER_CLIENT_SECRET` - Regenerate in Twitter Developer Portal
- [ ] `OPENROUTER_API_KEY` - Regenerate in OpenRouter Dashboard
- [ ] Supabase anon key - Rotate in Supabase dashboard

**Steps:**
1. [ ] Login to each service and regenerate keys
2. [ ] Update `.env.local` with new values
3. [ ] Verify `.env` is NOT in git
4. [ ] Add `.env` to `.gitignore` if missing
5. [ ] Remove from git history:
   ```bash
   git filter-branch --tree-filter 'rm -f .env' -- --all
   git push origin --force --all
   ```

---

## Phase 2: High Priority (1-2 weeks)

### 7. Add Comprehensive Logging
**File:** `lib/logging.ts`  
**Estimated Time:** 3-4 hours

- [ ] Create logging utility function
- [ ] Log all API requests with IP address
- [ ] Log authentication attempts
- [ ] Log all database modifications
- [ ] Log error events
- [ ] Set up external logging (Datadog, Sentry, or LogRocket)

```typescript
// lib/logging.ts
export async function logApiEvent(
  endpoint: string,
  method: string,
  request: NextRequest,
  status: number,
  details?: any
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    endpoint,
    method,
    ip: request.ip || request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
    status,
    ...details,
  };
  
  console.log(JSON.stringify(logEntry));
  
  // TODO: Send to external logging service
  // await sendToDatadog(logEntry);
}
```

- [ ] Use in all API endpoints

---

### 8. Enable Supabase Row Level Security (RLS)
**Estimated Time:** 2-3 hours

**File:** Database migrations

```sql
-- Enable RLS on all tables
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;

-- Create read policy for creators (public)
CREATE POLICY "creators_select"
  ON creators FOR SELECT
  USING (true);

-- Only owner can update their creator profile
CREATE POLICY "creators_update"
  ON creators FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can only see their own tips
CREATE POLICY "tips_select"
  ON tips FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM creators WHERE id = creator_id));
```

- [ ] Write migration scripts
- [ ] Test RLS policies
- [ ] Verify data isolation

---

### 9. Implement Transaction Verification
**Estimated Time:** 2-3 hours

**File:** `lib/blockchain-verification.ts`

```typescript
import { Connection, PublicKey } from "@solana/web3.js";

export async function verifyTransaction(
  signature: string,
  expectedAmount: number,
  expectedRecipient: string
): Promise<{ valid: boolean; error?: string }> {
  const connection = new Connection(
    process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
  );

  try {
    const tx = await connection.getTransaction(signature);
    if (!tx) {
      return { valid: false, error: "Transaction not found" };
    }

    // Verify the transaction is confirmed
    if (tx.blockTime === null) {
      return { valid: false, error: "Transaction not confirmed" };
    }

    // Verify amount and recipient
    // TODO: Parse transaction instructions and verify
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
```

- [ ] Create blockchain verification utility
- [ ] Use in tip confirmation endpoint
- [ ] Test with real transactions

---

### 10. Add Input Validation Helper
**File:** `lib/validation.ts`  
**Estimated Time:** 1-2 hours

```typescript
import bs58 from "bs58";

export function isValidSolanaAddress(address: string): boolean {
  try {
    const decoded = bs58.decode(address);
    return decoded.length === 32;
  } catch {
    return false;
  }
}

export function validateCreatorInput(body: any): string[] {
  const errors: string[] = [];

  if (!body.slug || body.slug.length < 3 || body.slug.length > 50) {
    errors.push("Slug must be 3-50 characters");
  }

  if (!isValidSolanaAddress(body.wallet_address)) {
    errors.push("Invalid Solana wallet address");
  }

  if (!body.name || body.name.length > 100) {
    errors.push("Name must be 1-100 characters");
  }

  if (body.bio && body.bio.length > 500) {
    errors.push("Bio must be max 500 characters");
  }

  if (body.avatar_url && body.avatar_url.length > 1000) {
    errors.push("Avatar URL must be max 1000 characters");
  }

  return errors;
}

export function validateAmount(
  amount: string,
  min: number = 0.01,
  max: number = 100
): string | null {
  const num = parseFloat(amount);
  
  if (isNaN(num)) {
    return "Amount must be a number";
  }
  
  if (num < min || num > max) {
    return `Amount must be between ${min} and ${max}`;
  }
  
  if (amount.split(".")[1]?.length > 6) {
    return "Amount can have at most 6 decimal places";
  }
  
  return null;
}
```

- [ ] Create validation utilities
- [ ] Use in all endpoints
- [ ] Test edge cases

---

## Phase 3: Medium Priority (1 month)

### 11. CORS Configuration
- [ ] Set appropriate CORS headers
- [ ] Whitelist specific origins
- [ ] Remove wildcard (*) from production

### 12. Webhook Signature Verification
- [ ] Verify Vercel Cron signatures before running agent
- [ ] Prevent external actor from triggering agent via webhook spoofing

### 13. Admin Dashboard
- [ ] Create admin UI to monitor API activity
- [ ] View all transactions and decisions
- [ ] Monitor wallet balance and agent activity
- [ ] View error logs

### 14. API Key Rotation
- [ ] Implement scheduled secret rotation
- [ ] Audit API key usage
- [ ] Revoke old keys after rotation

---

## Testing Checklist

### Security Tests

- [ ] **Test 1:** Agent run without auth should return 401
  ```bash
  curl -X POST http://localhost:3000/api/agent/run
  ```

- [ ] **Test 2:** Creator creation requires session
  ```bash
  curl -X POST http://localhost:3000/api/creators \
    -H "Content-Type: application/json" \
    -d '{"slug":"test","wallet_address":"...","name":"test"}'
  # Should return 401
  ```

- [ ] **Test 3:** Invalid wallet address rejected
  ```bash
  curl -X POST http://localhost:3000/api/creators \
    -H "Content-Type: application/json" \
    -d '{"slug":"test","wallet_address":"invalid","name":"test"}'
  # Should return 400
  ```

- [ ] **Test 4:** Negative amounts rejected
  ```bash
  curl http://localhost:3000/api/x402/tip/test/pay-solana?amount=-100
  # Should return 400
  ```

- [ ] **Test 5:** Rate limiting works
  ```bash
  for i in {1..20}; do
    curl -X POST http://localhost:3000/api/agent/run
  done
  # Should start returning 429 after limit
  ```

- [ ] **Test 6:** SQL injection attempts blocked
  ```bash
  curl -X POST http://localhost:3000/api/creators \
    -d "slug=test'; DROP TABLE creators; --"
  # Should sanitize or reject
  ```

- [ ] **Test 7:** XSS attempts blocked
  ```bash
  curl -X POST http://localhost:3000/api/creators \
    -d "name=<script>alert('xss')</script>"
  # Should sanitize
  ```

- [ ] **Test 8:** Secrets not exposed
  ```bash
  curl http://localhost:3000/.env
  # Should return 404
  ```

---

## Sign-Off

Once all Phase 1 items are complete:

- [ ] All 5 CRITICAL vulnerabilities fixed
- [ ] Rate limiting implemented
- [ ] Secrets rotated and removed from git
- [ ] Input validation added
- [ ] Manual security tests pass

**Ready for production? YES / NO**

---

## References

- Full audit: See `SECURITY_AUDIT.md`
- Summary: See `SECURITY_SUMMARY.md`
- Environment setup: See `.env.example`
