/**
 * Input validation utilities for payment amounts
 */

export interface ValidationResult {
  valid: boolean
  error?: string
  value?: number
}

export function validateTipAmount(amount: string): ValidationResult {
  const num = parseFloat(amount)

  if (isNaN(num)) {
    return { valid: false, error: "Amount must be a valid number" }
  }

  return { valid: true, value: num }
}
