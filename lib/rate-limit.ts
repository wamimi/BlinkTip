/**
 * Rate limiting utilities using Upstash Redis
 */

import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
