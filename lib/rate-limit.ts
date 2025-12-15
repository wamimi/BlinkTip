/**
 * Rate limiting utilities using Upstash Redis
 */

import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number
  /** Time window in seconds */
  windowInSeconds: number
}
