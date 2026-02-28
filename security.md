# IntentDraw Security Guidelines

## Core Principles

1. No secrets exposed to client
2. All user data isolated by default (RLS)
3. AI-generated content is untrusted
4. Zero-trust API architecture
5. Least privilege access

---

## Secret Management

| Variable | Where Used | Browser Visible? |
|----------|-----------|------------------|
| `NEXT_PUBLIC_*` | Client + Server | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server ONLY | ❌ NEVER |
| `GOOGLE_AI_API_KEY` | Server ONLY | ❌ NEVER |
| `GROQ_API_KEY` | Server ONLY | ❌ NEVER |

---

## API Route Requirements

Every route must:
- [ ] Verify authentication
- [ ] Validate input with Zod
- [ ] Limit payload size
- [ ] Mask error details
- [ ] Check rate limits

---

## AI Security

### Prompt Injection Prevention
- User input → `user` role message ONLY
- System prompts → hardcoded strings only
- Wrap user input with delimiters
- See `src/lib/ai/prompt-rules.ts`

### Output Sanitization
- Remove `<script>` tags
- Remove event handlers (`onclick`, etc.)
- Block `javascript:` URLs
- See `src/lib/utils/sanitize.ts`

---

## Preview Sandbox

Generated HTML renders in iframe:

```html
<iframe sandbox="allow-scripts">