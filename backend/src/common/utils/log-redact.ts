
export const LOG_REDACT_PATHS = [

  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-session-id"]',
  'req.headers["x-internal-request"]',
  'res.headers["set-cookie"]',
  'authorization',
  'cookie',

  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'refreshToken',
  'accessToken',
  'token',
  'jwt',

  'cccd',
  'mst',
  'payerCccd',
  'taxId',
  'document',
  'email',
  'phone',
  'cellphone',
  'celular',
  'telefone',

  'address',
  'street',
  'ward',
  'district',
  'province',
  'postalCode',

  'creditCard',
  'cardNumber',
  'securityCode',
  'cvv',
  'cardholderName',

  'clientSecret',
  'client_secret',
  'oauthClientSecret',
  'mpAccessToken',
  'MP_ACCESS_TOKEN',
  'turnstileSecret',
  'jwtSecret',
  'affiliateIpHashSalt',
  'otpPepper',
  'webhookSecret',

  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.cccd',
  'req.body.mst',
  'req.body.payerCccd',
  'req.body.email',
  'req.body.phone',
  'req.body.token',
  'req.body.refreshToken',
  'req.body.clientSecret',
  'body.password',
  'body.cccd',
  'body.mst',
  'body.email',
  'body.phone',
  'body.token',
];

const REDACTED_PLACEHOLDER = '[Redacted]';

const REDACT_KEY_SET = new Set(
  LOG_REDACT_PATHS.flatMap((path) => {

    const segs = path.split('.');
    const last = segs[segs.length - 1];

    const cleaned = last.replace(/^\["?|"?\]$/g, '');
    return [cleaned.toLowerCase()];
  }),
);

export function redactObject<T>(input: T, depth = 0): T {
  if (depth > 50) return input;
  if (input === null || input === undefined) return input;

  if (Array.isArray(input)) {
    return input.map((item) => redactObject(item, depth + 1)) as unknown as T;
  }

  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      input as Record<string, unknown>,
    )) {
      if (REDACT_KEY_SET.has(key.toLowerCase())) {
        out[key] = REDACTED_PLACEHOLDER;
      } else {
        out[key] = redactObject(value, depth + 1);
      }
    }
    return out as T;
  }

  return input;
}

export const PINO_REDACT_OPTIONS = {
  paths: LOG_REDACT_PATHS,
  censor: REDACTED_PLACEHOLDER,
  remove: false,
};
