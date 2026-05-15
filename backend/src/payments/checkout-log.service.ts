import {
    Injectable,
    Logger,
    OnModuleInit,
    OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { captureFailOpen } from '../observability/fail-open-capture';

const RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
// Distributed lock TTL: cleanup tipico demora <1min. Lock 5min cobre slow
// delete + imprevistos sem prender cleanup eternamente se container crashar.
const CLEANUP_LOCK_KEY = 'cleanup:lock:checkout-log';
const CLEANUP_LOCK_TTL_SECONDS = 300;

// Match case-insensitive: dev pode mandar `cardToken`, `card_token`, `CardToken`.
// Sets em lowercase + key.toLowerCase() na comparação fecha bypass por casing.
const SENSITIVE_KEYS = new Set([
    'cardtoken',
    'card_token',
    'payercpf',
    'payer_cpf',
    'password',
    'token',
    'securitycode',
    'security_code',
    'cvv',
]);

// Keys que contêm email — mask em vez de redact pra preservar debug
// (admin precisa saber QUE email recebeu, não só "[REDACTED]"). LGPD:
// mask atende minimização de dados.
const EMAIL_KEYS = new Set([
    'to',
    'email',
    'customeremail',
    'customer_email',
    'payeremail',
    'payer_email',
    'useremail',
    'user_email',
]);

// Caps anti-DoS: array > 50 trunca; string > 1000 trunca; recursão > 10
// niveis vira marker; total de nós > 5000 vira marker (Gemini R4 #A:
// `visited.delete()` p/ siblings reabriu Object-Bomb — counter fecha).
const ARRAY_CAP = 50;
const STRING_CAP = 1000;
const MAX_DEPTH = 10;
const MAX_NODES = 5000;

interface SanitizeState {
    visited: WeakSet<object>;
    depth: number;
    nodes: { count: number };
}

// Truncate UTF-16 safe: slice + Array.from pra rejoin sem cortar surrogate
// pair no meio (Gemini R4 #B). Postgres rejeita string com lone surrogate
// → INSERT falha → flow quebra. Buffer +2 cobre o caso de slice cortar
// dentro do par; Array.from converte em codepoints, slice no codepoint
// boundary, join restaura.
function safeTruncate(s: string, max: number): string {
    if (s.length <= max) return s;
    // Worst case 100% surrogate pairs (string só de emojis): cada emoji =
    // 2 code units. slice(0, max*2) garante coletarmos pelo menos max
    // codepoints. Array.from desafora pares; slice(0, max) limita ao máximo
    // de codepoints. Sem desperdício se string for ASCII (slice já curto).
    return Array.from(s.slice(0, max * 2))
        .slice(0, max)
        .join('');
}

function maskEmail(email: string): string {
    // Cap ANTES de processar — atacante mandando email de 500MB faria
    // Array.from() alocar array gigante, OOM (Gemini R3 #B).
    const safe = safeTruncate(email, STRING_CAP);
    // lastIndexOf cobre quoted local parts (ex: "a@b"@host.com)
    const at = safe.lastIndexOf('@');
    if (at <= 0) return '[invalid-email]';
    // Array.from preserva surrogate pairs (emoji/Unicode complex) — string
    // indexing quebraria caracter no meio.
    const localChars = Array.from(safe.slice(0, at));
    const domain = safe.slice(at + 1);
    // Conservador: revela só o primeiro char (não o último). Pra short
    // emails (≤2 chars) mascara tudo. Reduz entropia pra re-identificação.
    const maskedLocal =
        localChars.length <= 2
            ? '*'.repeat(localChars.length)
            : `${localChars[0]}***`;
    return `${maskedLocal}@${domain}`;
}

function capArray<T>(arr: T[]): unknown[] {
    if (arr.length <= ARRAY_CAP) return arr as unknown[];
    return [
        ...arr.slice(0, ARRAY_CAP),
        { __truncated: true, totalRemoved: arr.length - ARRAY_CAP },
    ];
}

function capString(s: string): string {
    if (s.length <= STRING_CAP) return s;
    // safeTruncate evita lone surrogate (Postgres-incompatible) — Gemini R4 #B
    return `${safeTruncate(s, STRING_CAP)}... [TRUNCATED ${s.length - STRING_CAP} chars]`;
}

// Bloqueia prototype pollution via keys controladas externamente
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Aceita keys legítimas que aparecem em payloads reais: dot ('user.email'
// flatten), space ('first name'), colon ('x-trace:id'), além do alfanumérico
// + _ + -. Length cap 128 anti DoS via key gigante. Drop silencioso de keys
// fora do padrão era visto como gap (Gemini R4 #C: bug lógico em prod).
const SAFE_KEY_RE = /^[a-zA-Z0-9_\-. :]{1,128}$/;

function safeKey(key: string): boolean {
    return !FORBIDDEN_KEYS.has(key) && SAFE_KEY_RE.test(key);
}

function sanitize(
    value: unknown,
    state: SanitizeState = {
        visited: new WeakSet(),
        depth: 0,
        nodes: { count: 0 },
    },
): unknown {
    if (++state.nodes.count > MAX_NODES) return '[MAX_NODES_REACHED]';

    // 1. Primitivos. BigInt/Symbol/Function quebrariam JSON.stringify
    //    downstream (TypeError) — atacante manda `{n: 1n}` e log crasha
    //    (Gemini R5 #A). Convertemos pra string segura.
    if (value === null || typeof value !== 'object') {
        if (typeof value === 'string') return capString(value);
        if (typeof value === 'bigint') return `${value}n`;
        if (typeof value === 'symbol') return value.toString();
        if (typeof value === 'function') return '[FUNCTION]';
        return value;
    }

    // 2. Native objects — Object.entries() devolve [] em Date/Error/RegExp
    //    porque suas props nativas são non-enumerable. Sem este branch,
    //    Error vira {} no log → debug de incidente fica cego (Gemini R5 #B).
    if (value instanceof Date) {
        // Invalid Date (`new Date('foo')`).toISOString() throws RangeError.
        // Atacante manda data malformada e logger crasha (Gemini R6 #A).
        return Number.isNaN(value.getTime())
            ? '[INVALID_DATE]'
            : value.toISOString();
    }
    if (value instanceof RegExp) return value.toString();
    if (value instanceof Error) {
        return {
            name: value.name,
            // Defesa contra Error.message override pra non-string (raro mas possível).
            message:
                typeof value.message === 'string'
                    ? capString(value.message)
                    : '[NON_STRING_MESSAGE]',
            // stack pode ter 10KB+; redact por padrão pra controle de tamanho.
            // Caller que precisa stack passa via params.error → formatError.
            stack: '[REDACTED]',
        };
    }

    // 3. Cycle/DAG — objeto já visitado vira marker. NÃO deletamos do
    //    visited no finally (Gemini R5 #D): manter no Set transforma
    //    DAGs em true O(N) e fecha "quota exhaustion" attack onde
    //    sibling ref consome MAX_NODES suprimindo dados depois. Trade-off:
    //    sibling ref legítimo aparece como [CIRCULAR_OR_DUPLICATE] no log
    //    (admin entende = "mesmo objeto referenciado 2x").
    if (state.visited.has(value as object)) return '[CIRCULAR_OR_DUPLICATE]';
    if (state.depth > MAX_DEPTH) return '[MAX_DEPTH_REACHED]';
    state.visited.add(value as object);
    state.depth++;

    let result: unknown;
    try {
        if (Array.isArray(value)) {
            const capped = capArray(value);
            result = capped.map((item) => sanitize(item, state));
        } else {
            // Object — case-insensitive key lookup. Redact por KEY antes de
            // typeof check fecha type spoof (Gemini R3 #A).
            const sanitizedObj: Record<string, unknown> = Object.create(null);
            // Object.entries chama getters; Proxy/getter lançante crasha
            // todo o sanitize. Wrap pra defender o pipeline de log (Gemini R6 #B).
            let entries: [string, unknown][];
            try {
                entries = Object.entries(value as Record<string, unknown>);
            } catch {
                result = '[UNREADABLE_OBJECT]';
                return result;
            }
            for (const [rawKey, v] of entries) {
                if (!safeKey(rawKey)) continue;
                const lk = rawKey.toLowerCase();
                if (SENSITIVE_KEYS.has(lk)) {
                    sanitizedObj[rawKey] = '[REDACTED]';
                    continue;
                }
                if (EMAIL_KEYS.has(lk) && typeof v === 'string' && v) {
                    sanitizedObj[rawKey] = maskEmail(v);
                    continue;
                }
                // Recursão isolada: getter lançante em key específica não
                // contamina o resto do objeto.
                try {
                    sanitizedObj[rawKey] = sanitize(v, state);
                } catch {
                    sanitizedObj[rawKey] = '[SANITIZATION_ERROR]';
                }
            }
            result = sanitizedObj;
        }
    } finally {
        // Não deletamos visited — DAG vira O(N), evita quota-exhaustion attack.
        state.depth--;
    }
    return result;
}

function safeStringify(data: unknown): string | undefined {
    if (data === undefined || data === null) return undefined;
    try {
        return JSON.stringify(sanitize(data));
    } catch {
        return String(data);
    }
}

function formatError(err: unknown): string {
    if (err instanceof Error) {
        const extra =
            (err as unknown as Record<string, unknown>).cause ??
            (err as unknown as Record<string, unknown>).response ??
            (err as unknown as Record<string, unknown>).body;
        let msg = err.message;
        if (extra) {
            try {
                msg += ' | ' + JSON.stringify(extra);
            } catch {
                // ignore
            }
        }
        if (err.stack) msg += '\n' + err.stack;
        return msg;
    }
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}

export interface CheckoutLogParams {
    step: string;
    status: 'success' | 'error';
    orderId?: string;
    userId?: string;
    method?: string;
    request?: unknown;
    response?: unknown;
    error?: unknown;
    duration?: number;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
}

@Injectable()
export class CheckoutLogService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(CheckoutLogService.name);
    private cleanupInterval?: NodeJS.Timeout;

    constructor(
        private prisma: PrismaService,
        private redis: RedisService,
    ) { }

    async onModuleInit() {
        // LGPD: CheckoutLog contem IP, user-agent, email (via payer). Sem cron
        // fixo, retention virava "30 dias desde o ultimo restart" — em uptime
        // longo (> 30d), PII acumulava indefinidamente.
        //
        // Multi-container: cada instancia roda setInterval → N cleanups/dia.
        // Redis setNX lock garante SO UMA instancia executa por dia (TTL 5min,
        // se crash no meio, proximo tick 24h depois retenta).
        this.runWithLock().catch(() => undefined);

        this.cleanupInterval = setInterval(() => {
            this.runWithLock().catch(() => undefined);
        }, CLEANUP_INTERVAL_MS);

        // .unref() evita que o interval segure o Node process aberto na hora
        // do shutdown gracioso. Sem isso, SIGTERM pode travar ate o tick.
        this.cleanupInterval.unref();
    }

    onModuleDestroy() {
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    }

    private async runWithLock(): Promise<void> {
        // UUID unico por execucao — usado no releaseLock CAS (compare-and-swap).
        // Previne classic distributed lock bug: Worker A acquire, hangs, TTL
        // expira, Worker B acquire novo lock, Worker A finally DEL blindly
        // → deleta lock do B. Lua CAS garante DEL apenas se valor ainda bate.
        const lockValue = randomUUID();

        const acquired = await this.redis.setNX(
            CLEANUP_LOCK_KEY,
            lockValue,
            CLEANUP_LOCK_TTL_SECONDS,
        );
        if (!acquired) {
            this.logger.debug('Cleanup skipped — another instance holds the lock');
            return;
        }
        try {
            await this.cleanup(RETENTION_DAYS);
        } catch (err: unknown) {
            this.logger.error(
                `Cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
            );
            captureFailOpen(err, 'checkout_log_cleanup');
        } finally {
            // releaseLock (RedisService) usa Lua EVAL pra CAS delete atomico —
            // so apaga se o valor ainda bate com nosso UUID. Se TTL ja expirou
            // e outro worker adquiriu, retorna false sem afetar o lock alheio.
            await this.redis
                .releaseLock(CLEANUP_LOCK_KEY, lockValue)
                .catch(() => undefined);
        }
    }

    async log(params: CheckoutLogParams): Promise<void> {
        try {
            await this.prisma.checkoutLog.create({
                data: {
                    step: params.step,
                    status: params.status,
                    orderId: params.orderId,
                    userId: params.userId,
                    method: params.method,
                    request: safeStringify(params.request),
                    response: safeStringify(params.response),
                    error: params.error ? formatError(params.error) : undefined,
                    duration: params.duration,
                    ip: params.ip,
                    userAgent: params.userAgent,
                    // metadata passa pelo sanitize() pra cobrir email mask + array cap +
                    // SENSITIVE_KEYS redact (Gemini #A+#B). Antes era JSON.stringify
                    // direto, vazando customerEmail e arrays sem cap.
                    metadata: safeStringify(params.metadata),
                },
            });
        } catch (err) {
            // Fire-and-forget: logging should never break the checkout flow
            this.logger.error(
                `Failed to save checkout log: ${(err as Error).message}`,
            );
        }
    }

    async findByOrder(orderId: string) {
        return this.prisma.checkoutLog.findMany({
            where: { orderId },
            orderBy: { createdAt: 'asc' },
        });
    }

    /**
     * Remove logs mais antigos que `days` dias.
     * Chamado periodicamente (ex: cron diário ou no startup).
     */
    async cleanup(days = 30): Promise<number> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const result = await this.prisma.checkoutLog.deleteMany({
            where: { createdAt: { lt: cutoff } },
        });

        if (result.count > 0) {
            this.logger.log(
                `Cleanup: removed ${result.count} checkout logs older than ${days} days`,
            );
        }

        return result.count;
    }
}