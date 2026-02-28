// =============================================================================
// PROMPT INJECTION PREVENTION RULES
// =============================================================================
// 
// Rule 1: User input ALWAYS goes in the `user` role message.
//         NEVER in the `system` role message.
// 
// Rule 2: System prompts are hardcoded strings only.
//         No user input, no env vars, no dynamic content.
// 
// Rule 3: User input is wrapped with explicit delimiters.
// 
// CORRECT pattern:
//   messages: [
//     { role: 'system', content: HARDCODED_SYSTEM_PROMPT },
//     { role: 'user',   content: `[USER_PROMPT_START]\n${userInput}\n[USER_PROMPT_END]` }
//   ]
// 
// WRONG pattern (injection risk):
//   messages: [
//     { role: 'system', content: `You are a designer. User wants: ${userInput}` }
//   ]
// 
// =============================================================================

export const PROMPT_DELIMITERS = {
  start: '[USER_PROMPT_START]',
  end: '[USER_PROMPT_END]',
} as const

/**
 * Wraps user input with delimiters for safe inclusion in prompts.
 */
export function wrapUserPrompt(userInput: string): string {
  return `${PROMPT_DELIMITERS.start}\n${userInput}\n${PROMPT_DELIMITERS.end}`
}

/**
 * Basic sanitization of user prompts.
 * Removes attempts to break out of delimiters or inject system instructions.
 */
export function sanitizeUserPrompt(input: string): string {
  let sanitized = input
  
  // Remove delimiter injection attempts
  sanitized = sanitized.replace(/\[USER_PROMPT_START\]/gi, '')
  sanitized = sanitized.replace(/\[USER_PROMPT_END\]/gi, '')
  
  // Remove common injection patterns
  sanitized = sanitized.replace(/ignore previous instructions/gi, '')
  sanitized = sanitized.replace(/ignore all previous/gi, '')
  sanitized = sanitized.replace(/system:/gi, '')
  sanitized = sanitized.replace(/assistant:/gi, '')
  
  return sanitized.trim()
}