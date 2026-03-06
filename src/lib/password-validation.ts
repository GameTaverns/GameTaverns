/**
 * Shared password validation utility.
 * Enforces: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 symbol.
 * Used across all password flows: signup, change, reset.
 */

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

const PASSWORD_RULES = [
  { test: (pw: string) => pw.length >= 8, message: "Must be at least 8 characters" },
  { test: (pw: string) => /[A-Z]/.test(pw), message: "Must contain at least one uppercase letter" },
  { test: (pw: string) => /[a-z]/.test(pw), message: "Must contain at least one lowercase letter" },
  { test: (pw: string) => /[0-9]/.test(pw), message: "Must contain at least one number" },
  { test: (pw: string) => /[^A-Za-z0-9]/.test(pw), message: "Must contain at least one special character (!@#$%^&*...)" },
];

export function validatePassword(password: string): PasswordValidationResult {
  const errors = PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.message);
  return { valid: errors.length === 0, errors };
}

export const PASSWORD_REQUIREMENTS_TEXT =
  "Password must be at least 8 characters with at least one uppercase letter, one lowercase letter, one number, and one special character.";

/**
 * Server-side password validation (same logic, for edge functions).
 * Copy this regex check into edge functions to avoid import issues.
 */
export function validatePasswordServer(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) return { valid: false, error: "Password must be at least 8 characters" };
  if (!/[A-Z]/.test(password)) return { valid: false, error: "Password must contain at least one uppercase letter" };
  if (!/[a-z]/.test(password)) return { valid: false, error: "Password must contain at least one lowercase letter" };
  if (!/[0-9]/.test(password)) return { valid: false, error: "Password must contain at least one number" };
  if (!/[^A-Za-z0-9]/.test(password)) return { valid: false, error: "Password must contain at least one special character" };
  return { valid: true };
}
