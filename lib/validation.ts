/**
 * Input validation utilities for payment amounts
 */

export interface ValidationResult {
  valid: boolean
  error?: string
  value?: number
}
