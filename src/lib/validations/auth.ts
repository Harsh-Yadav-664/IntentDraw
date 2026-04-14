import { z } from 'zod'

// =============================================================================
// Auth Validation Schemas
// =============================================================================

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')

export const passwordSchema = z
  .string()
  .min(1, 'Password is required')
  .min(8, 'Password must be at least 8 characters')

export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be less than 50 characters')

// =============================================================================
// Form Schemas
// =============================================================================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export const signupSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

// =============================================================================
// Types
// =============================================================================

export type LoginFormData = z.infer<typeof loginSchema>
export type SignupFormData = z.infer<typeof signupSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

// =============================================================================
// Helper: Extract field errors from ZodError (Zod v4 compatible)
// =============================================================================

export function extractFieldErrors<T extends Record<string, unknown>>(
  error: z.ZodError<T>
): Partial<Record<keyof T | 'root', string>> {
  const fieldErrors: Partial<Record<keyof T | 'root', string>> = {}
  
  // Zod v4 uses .issues instead of .errors
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof T
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = issue.message
    }
  }
  
  return fieldErrors
}