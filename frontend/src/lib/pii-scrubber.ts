

const PII_PATTERNS: Array<{ name: string; regex: RegExp }> = [

  { name: 'CCCD', regex: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g },

  { name: 'MST', regex: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g },

  { name: 'EMAIL', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },

  { name: 'CARD', regex: /\b(?:\d[ -]?){12,18}\d\b/g },

  { name: 'PHONE', regex: /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}\b/g },
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SENSITIVE_KEYS = [
  'email', 'cccd', 'mst', 'token', 'password', 'senha',
  'doc', 'documento', 'phone', 'telefone', 'celular',
  'card', 'cartao', 'cvv', 'access_token', 'refresh_token', 'code',
].map(escapeRegExp).join('|');

const KEY_AFFIX = '[\\w-]{0,30}';
const SENSITIVE_QUERY_REGEX = new RegExp(
  `([?&])(${KEY_AFFIX}(?:${SENSITIVE_KEYS})${KEY_AFFIX})(?:\\[[^\\]]*\\])*=([^&\\s#]+)`,
  'gi',
);

const SENSITIVE_JSON_REGEX = new RegExp(
  `(["']?)(${KEY_AFFIX}(?:${SENSITIVE_KEYS})${KEY_AFFIX})\\1\\s*:\\s*(?:(["'])([^"'\\n]*?)\\3|([^,\\s}\\]]+))`,
  'gi',
);

const MAX_INPUT_LENGTH = 5000;

export function maskPII(input: string): string {
  if (!input || typeof input !== 'string') return input;
  let out = input;
  let truncated = false;
  if (out.length > MAX_INPUT_LENGTH) {
    out = out.slice(0, MAX_INPUT_LENGTH);
    truncated = true;
  }
  for (const { name, regex } of PII_PATTERNS) {
    out = out.replace(regex, `[${name}_REDACTED]`);
  }
  out = out.replace(SENSITIVE_QUERY_REGEX, '$1$2=[REDACTED]');

  out = out.replace(SENSITIVE_JSON_REGEX, '$1$2$1:"[REDACTED]"');
  if (truncated) out += '...[TRUNCATED]';
  return out;
}
