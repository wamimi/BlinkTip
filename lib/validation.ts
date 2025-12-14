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

  if (num <= 0) {
    return { valid: false, error: "Amount must be greater than 0" }
  }

  if (num > 1000) {
    return { valid: false, error: "Amount cannot exceed $1000" }
  }

  if (amount.includes('e') || amount.includes('E')) {
    return { valid: false, error: "Exponential notation not allowed" }
  }

  const decimalPlaces = amount.split('.')[1]?.length || 0
  if (decimalPlaces > 2) {
    return { valid: false, error: "Amount cannot have more than 2 decimal places" }
  }

  return { valid: true, value: num }
}
