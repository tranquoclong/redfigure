

export interface CapturedError {
  type: 'http' | 'unhandled';
  message: string;
  url?: string;
  status?: number;
  timestamp: number;
}

export function isReportableHttpStatus(status: number): boolean {
  if (typeof status !== 'number' || !Number.isFinite(status)) return false;
  if (status < 500 || status > 599) return false;
  if (status === 503) return false;
  return true;
}

type Sink = (event: CapturedError, originalError?: unknown) => void;

const MAX_BUFFER = 50;
const buffer: CapturedError[] = [];
const originalErrors: unknown[] = [];
let activeSink: Sink | null = null;

function defaultSink(event: CapturedError): void {
  if (process.env.NODE_ENV !== 'production') {

    console.error('[error-reporter]', event.type, event.message, {
      url: event.url,
      status: event.status,
    });
  }
}

export function reportError(event: CapturedError, originalError?: unknown): void {
  buffer.push(event);
  originalErrors.push(originalError);
  if (buffer.length > MAX_BUFFER) {
    buffer.shift();
    originalErrors.shift();
  }

  const sink = activeSink ?? defaultSink;
  try {
    sink(event, originalError);
  } catch {

  }
}

export function setSink(sink: Sink): void {
  activeSink = sink;

  for (let i = 0; i < buffer.length; i++) {
    try {
      sink(buffer[i], originalErrors[i]);
    } catch {

    }
  }
}

export function clearSink(): void {
  activeSink = null;
}

export function getBufferedEvents(): readonly CapturedError[] {
  return buffer.slice();
}

export function __resetForTest(): void {
  buffer.length = 0;
  originalErrors.length = 0;
  activeSink = null;
}
