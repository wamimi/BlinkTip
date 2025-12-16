/**
 * Rate limiting utilities using Upstash Redis
 */

import { Redis } from '@upstash/redis'

// Vercel KV uses KV_REST_API_URL and KV_REST_API_TOKEN
// Upstash SDK expects UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number
  /** Time window in seconds */
  windowInSeconds: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Check if a request should be rate limited
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `rate_limit:${identifier}`
  const now = Date.now()
  const windowMs = config.windowInSeconds * 1000

  try {
    const data = await redis.get<{ count: number; resetAt: number }>(key)

    if (!data) {
      await redis.set(key, { count: 1, resetAt: now + windowMs }, { ex: config.windowInSeconds })
      return {
        success: true,
        limit: config.limit,
        remaining: config.limit - 1,
        reset: now + windowMs,
      }
    }

    const { count, resetAt } = data

    if (now > resetAt) {
      await redis.set(key, { count: 1, resetAt: now + windowMs }, { ex: config.windowInSeconds })
      return {
        success: true,
        limit: config.limit,
        remaining: config.limit - 1,
        reset: now + windowMs,
      }
    }

    if (count >= config.limit) {
      return {
        success: false,
        limit: config.limit,
        remaining: 0,
        reset: resetAt,
      }
    }

    const newCount = count + 1
    await redis.set(key, { count: newCount, resetAt }, { ex: Math.ceil((resetAt - now) / 1000) })

    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - newCount,
      reset: resetAt,
    }
  } catch (error) {
    console.error('[Rate Limit] Error:', error)
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit,
      reset: now + windowMs,
    }
  }
}
