// import {
//     Injectable,
//     BadRequestException,
//     InternalServerErrorException,
//     Logger,
// } from '@nestjs/common';
// import { MercadoPagoConfig, Payment } from 'mercadopago';
// import * as crypto from 'crypto';
// import { SettingsService } from '../settings/settings.service';
// import type { GatewayPaymentInfo } from './gateway.interface';

// const STATUS_MAP: Record<string, string> = {
//     approved: 'APPROVED',
//     authorized: 'APPROVED',
//     pending: 'PENDING',
//     in_process: 'PENDING',
//     rejected: 'FAILED',
//     cancelled: 'CANCELLED',
//     refunded: 'CANCELLED',
//     charged_back: 'CANCELLED',
// };

// // Extrai APENAS campos safe do erro. Antes o serializeError antigo dumpava
// // `err.response` inteiro — o SDK do MP costuma anexar objeto com response
// // data que pode incluir PII (email/nome/CPF do payer ecoado de volta no
// // caso de validation error). Com este approach, log tem status + MP error
// // code + message curta. Mais que suficiente pra debug, zero PII.
// // Sanitiza CRLF pra impedir log injection — sem isso, attacker com input
// // refletido em err.message pode forjar linhas de log (CWE-117).
// function sanitizeForLog(s: string): string {
//     return s.replace(/[\r\n\t]+/g, ' ').slice(0, 500);
// }

// function serializeError(err: unknown): string {
//     if (!(err instanceof Error)) {
//         try {
//             // Truncar pra evitar DoS via objeto gigante bloqueando event loop
//             // (CWE-400) — JSON.stringify eh sincrono.
//             const str = JSON.stringify(err);
//             return str.length > 500 ? str.slice(0, 500) + '...[TRUNCATED]' : str;
//         } catch {
//             return String(err).slice(0, 500);
//         }
//     }
//     // Axios/MP SDK errors normalmente tem `.response.status` e `.response.data`.
//     // Pegar so `status`, `message` e `error` (MP error code) — NAO o data inteiro
//     // (evita vazar PII do payer ecoada pelo MP em validation errors).
//     const response = (err as { response?: { status?: number; data?: unknown } })
//         .response;
//     const statusCode = response?.status;
//     const data = response?.data as
//         | { message?: string; error?: string; cause?: unknown }
//         | undefined;
//     const mpMessage = typeof data?.message === 'string' ? data.message : null;
//     const mpError = typeof data?.error === 'string' ? data.error : null;

//     const parts: string[] = [sanitizeForLog(err.message)];
//     if (statusCode) parts.push(`status=${statusCode}`);
//     if (mpError) parts.push(`mp_error=${sanitizeForLog(mpError)}`);
//     if (mpMessage) parts.push(`mp_message=${sanitizeForLog(mpMessage)}`);
//     return parts.join(' | ');
// }

// @Injectable()
// export class MercadoPagoClient {
//     readonly name = 'mercadopago' as const;
//     private readonly logger = new Logger(MercadoPagoClient.name);

//     // Cache do SDK Payment instance INDEXADO PELO ENCRYPTED TOKEN (Gemini #A):
//     // - Plaintext token NUNCA armazenado em prop (heap dump leak).
//     // - Cache hit pula AES decrypt em cada call (Gemini #2: CPU DoS defense
//     //   sob spam de checkout).
//     // Settings tem cache Redis 60s — encrypted lookup eh barato. Decrypt
//     // so roda quando ciphertext muda (= rotacao de key real).
//     private cachedPaymentApi: {
//         encryptedToken: string;
//         api: InstanceType<typeof Payment>;
//     } | null = null;

//     constructor(private readonly settingsService: SettingsService) {
//         // Lazy resolution: credenciais lidas via SettingsService on-demand
//         // (sessao 04/05/2026 — migracao de env pra DB encrypted, painel admin).
//         // Sem fail-fast no boot — primeira chamada sem credenciais lanca
//         // InternalServerError (config faltando = state interno, nao client error).
//     }

//     /**
//      * Lazy SDK instance — re-instancia se ciphertext do token mudou (admin
//      * rotacionou via painel). Cache pelo ENCRYPTED string (nao plaintext)
//      * minimiza exposure em memoria + evita decrypt redundante (Gemini #A+#2).
//      * Owner ausente das settings = InternalServerError + log.error (config
//      * missing eh problema infra, nao input invalido — Gemini #Vuln1).
//      */
//     private async getPaymentApi(): Promise<InstanceType<typeof Payment>> {
//         const encrypted = await this.settingsService.get(
//             'mercadopago_access_token',
//         );
//         if (!encrypted) {
//             this.logger.error(
//                 'Mercado Pago access_token ausente em Settings — popular via /admin/configuracoes',
//             );
//             throw new InternalServerErrorException(
//                 'Gateway de pagamento indisponivel. Tente novamente em instantes.',
//             );
//         }
//         if (this.cachedPaymentApi?.encryptedToken === encrypted) {
//             return this.cachedPaymentApi.api;
//         }
//         const decrypted = this.settingsService.decrypt(encrypted);
//         if (!decrypted) {
//             this.logger.error(
//                 'Mercado Pago access_token falhou ao descriptografar — Settings corrompida ou key rotacionada',
//             );
//             throw new InternalServerErrorException(
//                 'Gateway de pagamento indisponivel. Tente novamente em instantes.',
//             );
//         }
//         const config = new MercadoPagoConfig({ accessToken: decrypted });
//         const api = new Payment(config);
//         this.cachedPaymentApi = { encryptedToken: encrypted, api };
//         return api;
//     }

//     /**
//      * Resolve webhook secret via Settings. Retorna null (vs throw) pra que
//      * verifyWebhookSignature retorne false — caller (guard) trata como
//      * "assinatura invalida" e responde 401. Log.error em ambos casos
//      * (Gemini #B: missing secret eh infra failure — debug critico).
//      */
//     private async getWebhookSecret(): Promise<string | null> {
//         const encrypted = await this.settingsService.get(
//             'mercadopago_webhook_secret',
//         );
//         if (!encrypted) {
//             this.logger.error(
//                 'Mercado Pago webhook_secret ausente em Settings — webhooks nao serao processados',
//             );
//             return null;
//         }
//         const decrypted = this.settingsService.decrypt(encrypted);
//         if (!decrypted) {
//             this.logger.error(
//                 'Mercado Pago webhook_secret falhou ao descriptografar — Settings corrompida',
//             );
//             return null;
//         }
//         return decrypted;
//     }

//     async createPixPayment(params: {
//         amount: number;
//         description: string;
//         externalReference: string;
//         payerEmail: string;
//         payerCpf: string;
//         payerFirstName: string;
//         payerLastName: string;
//         expirationMinutes?: number;
//     }) {
//         const expiresAt = new Date(
//             Date.now() + (params.expirationMinutes ?? 15) * 60 * 1000,
//         ).toISOString();

//         const body = {
//             transaction_amount: params.amount,
//             payment_method_id: 'pix' as const,
//             description: params.description,
//             external_reference: params.externalReference,
//             date_of_expiration: expiresAt,
//             payer: {
//                 email: params.payerEmail,
//                 first_name: params.payerFirstName,
//                 last_name: params.payerLastName,
//                 identification: { type: 'CPF' as const, number: params.payerCpf },
//             },
//         };

//         this.logger.log(
//             `PIX payment request: amount=${params.amount}, email=${params.payerEmail}, ref=${params.externalReference}`,
//         );

//         // getPaymentApi fora do try/catch — InternalServerError de config
//         // ausente NAO deve virar BadRequest generico do PIX. Owner precisa
//         // ver erro real (popular settings) vs cliente ve mensagem amigavel.
//         const api = await this.getPaymentApi();

//         try {
//             const result = await api.create({ body });

//             this.logger.log(
//                 `PIX payment created: id=${result.id}, status=${result.status}`,
//             );

//             const txData = result.point_of_interaction?.transaction_data;

//             return {
//                 id: result.id!,
//                 qrCode: txData?.qr_code ?? '',
//                 qrCodeBase64: txData?.qr_code_base64 ?? '',
//                 ticketUrl: txData?.ticket_url ?? '',
//                 expiresAt: result.date_of_expiration ?? '',
//                 raw: result, // resposta crua do MP — persistida em PaymentEvent
//             };
//         } catch (err) {
//             // serializeError so no log interno — NUNCA na message do exception
//             // (BadRequestException.message vai pro cliente via HttpExceptionFilter).
//             // Nao logar PII (email/nome/telefone) em claro — LGPD. Contexto detalhado
//             // fica em PaymentEvent.rawData (via recordPaymentEvent) que ja eh sanitizado.
//             this.logger.error(
//                 `PIX payment FAILED: ${serializeError(err)}`,
//                 JSON.stringify({
//                     amount: params.amount,
//                     externalReference: params.externalReference,
//                 }),
//             );
//             throw new BadRequestException(
//                 'Nao foi possivel criar o pagamento PIX. Tente novamente em instantes.',
//             );
//         }
//     }

//     async createCreditCardPayment(params: {
//         amount: number;
//         token: string;
//         installments: number;
//         paymentMethodId: string;
//         description: string;
//         externalReference: string;
//         payerEmail: string;
//         payerCpf: string;
//         payerFirstName: string;
//         payerLastName: string;
//     }) {
//         const body = {
//             transaction_amount: params.amount,
//             token: params.token,
//             installments: params.installments,
//             payment_method_id: params.paymentMethodId,
//             description: params.description,
//             external_reference: params.externalReference,
//             payer: {
//                 email: params.payerEmail,
//                 first_name: params.payerFirstName,
//                 last_name: params.payerLastName,
//                 identification: { type: 'CPF' as const, number: params.payerCpf },
//             },
//         };

//         this.logger.log(
//             `CC payment request: amount=${params.amount}, installments=${params.installments}, method=${params.paymentMethodId}, ref=${params.externalReference}`,
//         );

//         const api = await this.getPaymentApi();

//         try {
//             const result = await api.create({ body });

//             this.logger.log(
//                 `CC payment result: id=${result.id}, status=${result.status}, detail=${result.status_detail}`,
//             );

//             return {
//                 id: result.id!,
//                 status: result.status ?? 'unknown',
//                 statusDetail: result.status_detail ?? '',
//                 cardLastFour: result.card?.last_four_digits ?? '',
//                 raw: result, // resposta crua do MP — persistida em PaymentEvent
//             };
//         } catch (err) {
//             this.logger.error(
//                 `CC payment FAILED: ${serializeError(err)}`,
//                 JSON.stringify({
//                     amount: params.amount,
//                     method: params.paymentMethodId,
//                 }),
//             );
//             throw new BadRequestException(
//                 'Nao foi possivel processar o pagamento com cartao. Verifique os dados e tente novamente.',
//             );
//         }
//     }

//     // Aceita BoletoParams unificado (igual PaymentGateway interface). MP
//     // requer firstName/lastName separados — derivados do payer.name (split
//     // no primeiro espaço). CPF/CNPJ é numero strip não-dígitos pra MP.
//     async createBoletoPayment(
//         params: import('./gateway.interface').BoletoParams,
//     ) {
//         // Cap nome a 100 chars ANTES de regex anti-ReDoS (Gemini hardening).
//         // \s+ em string maliciosa de 10MB poderia travar event loop.
//         const fullName = (params.payer.name?.trim() || 'Cliente').slice(0, 100);
//         const [firstName, ...rest] = fullName.split(/\s+/);
//         const lastName = rest.join(' ') || firstName;
//         const cpfDigits = (params.payer.cpf ?? '').replace(/\D/g, '');
//         // Defesa em camadas: OrdersService já valida, mas MP rejeita 400
//         // genérico se CPF inválido — feedback claro aqui.
//         if (cpfDigits.length !== 11 && cpfDigits.length !== 14) {
//             throw new BadRequestException(
//                 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos pra emitir boleto.',
//             );
//         }

//         const body = {
//             transaction_amount: params.amount,
//             payment_method_id: 'bolbradesco' as const,
//             description: params.description,
//             external_reference: params.externalReference,
//             payer: {
//                 email: params.payer.email,
//                 first_name: firstName,
//                 last_name: lastName,
//                 identification: { type: 'CPF' as const, number: cpfDigits },
//             },
//         };

//         this.logger.log(
//             `Boleto payment request: amount=${params.amount}, ref=${params.externalReference}`,
//         );

//         const api = await this.getPaymentApi();

//         try {
//             const result = await api.create({ body });

//             this.logger.log(
//                 `Boleto payment created: id=${result.id}, status=${result.status}`,
//             );

//             return {
//                 id: result.id!,
//                 boletoUrl: result.transaction_details?.external_resource_url ?? '',
//                 barcode: (result as any).barcode?.content ?? '',
//                 expiresAt: result.date_of_expiration ?? '',
//                 raw: result, // resposta crua do MP — persistida em PaymentEvent
//             };
//         } catch (err) {
//             this.logger.error(
//                 `Boleto payment FAILED: ${serializeError(err)}`,
//                 JSON.stringify({ amount: params.amount }),
//             );
//             throw new BadRequestException(
//                 'Nao foi possivel gerar o boleto. Tente novamente em instantes.',
//             );
//         }
//     }

//     async getPayment(paymentId: string): Promise<GatewayPaymentInfo> {
//         const api = await this.getPaymentApi();
//         try {
//             const result = await api.get({ id: paymentId });
//             return {
//                 status: (result.status as string) ?? 'unknown',
//                 amount: result.transaction_amount ?? 0,
//                 raw: result,
//             };
//         } catch (err) {
//             this.logger.error(
//                 `Get payment FAILED (id=${paymentId}): ${serializeError(err)}`,
//             );
//             // Mensagem generica — nao vaza o serializeError pro cliente.
//             throw new BadRequestException(
//                 'Erro ao consultar pagamento no Mercado Pago.',
//             );
//         }
//     }

//     mapStatus(gatewayStatus: string): string {
//         return STATUS_MAP[gatewayStatus] ?? 'PENDING';
//     }

//     async verifyWebhookSignature(params: {
//         xSignature: string;
//         xRequestId: string;
//         dataId: string;
//     }): Promise<boolean> {
//         try {
//             if (!params.xSignature) return false;

//             // Webhook secret resolvido on-demand (sessao 04/05/2026 — DB encrypted
//             // via SettingsService, painel admin). Sem secret = nao configurado =
//             // rejeita assinatura (vs throw — caller eh guard que faz 401).
//             const webhookSecret = await this.getWebhookSecret();
//             if (!webhookSecret) return false;

//             // Object.create(null) + allowlist evita prototype pollution via header
//             // controlado pelo MP (ou atacante simulando MP).
//             const parts: Record<string, string> = Object.create(null);
//             const ALLOWED_KEYS = new Set(['ts', 'v1']);
//             for (const part of params.xSignature.split(',')) {
//                 const [key, ...valueParts] = part.split('=');
//                 const trimmed = key?.trim();
//                 if (trimmed && ALLOWED_KEYS.has(trimmed) && valueParts.length) {
//                     parts[trimmed] = valueParts.join('=');
//                 }
//             }

//             const ts = parts['ts'];
//             const v1 = parts['v1'];
//             if (!ts || !v1) return false;

//             // Replay attack defense (Gemini R7 #2): atacante captura webhook
//             // valido e re-envia. Sem timestamp tolerance, mesmo `ts` continua
//             // gerando hash valido. MP recomenda janela de 5min.
//             const tsNum = Number(ts);
//             if (!Number.isFinite(tsNum)) return false;
//             const TOLERANCE_MS = 5 * 60 * 1000;
//             const now = Date.now();
//             // MP envia ts em MILISEGUNDOS desde epoch.
//             if (Math.abs(now - tsNum) > TOLERANCE_MS) return false;

//             const manifest = `id:${params.dataId};request-id:${params.xRequestId};ts:${ts};`;
//             const hmac = crypto
//                 .createHmac('sha256', webhookSecret)
//                 .update(manifest)
//                 .digest('hex');

//             // Length check ANTES do timingSafeEqual (Gemini #2): timingSafeEqual
//             // throw se buffers tem comprimento diferente — caia no catch e
//             // retornaria false, mas erro mascarado quebra observability + sutilmente
//             // negocia timing safety.
//             const expected = Buffer.from(hmac);
//             const provided = Buffer.from(v1);
//             if (expected.length !== provided.length) return false;
//             return crypto.timingSafeEqual(expected, provided);
//         } catch (err) {
//             // Log.error em vez de catch silencioso (Gemini #3): debugging fica
//             // possivel quando attacker manda payload malformed.
//             this.logger.error(
//                 `MP verifyWebhookSignature error: ${err instanceof Error ? err.message : String(err)}`,
//             );
//             return false;
//         }
//     }
// }