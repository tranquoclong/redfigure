import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  afterEach(() => {
    service.reset();
  });

  it('initializes with standard HTTP counters/histograms', async () => {
    const text = await service.getMetrics();
    expect(text).toContain('http_requests_total');
    expect(text).toContain('http_request_duration_seconds');
    expect(text).toContain('process_cpu_user_seconds_total');
  });

  it('observeHttp increments counter by method+route+status', async () => {
    service.observeHttp('GET', '/api/v1/products', 200, 0.05);
    service.observeHttp('GET', '/api/v1/products', 200, 0.1);
    service.observeHttp('POST', '/api/v1/orders', 500, 1.2);

    const text = await service.getMetrics();
    expect(text).toMatch(
      /http_requests_total\{[^}]*method="GET"[^}]*route="\/api\/v1\/products"[^}]*status_code="200"\} 2/,
    );
    expect(text).toMatch(
      /http_requests_total\{[^}]*method="POST"[^}]*route="\/api\/v1\/orders"[^}]*status_code="500"\} 1/,
    );
  });

  it('observeBullJob increments BullMQ metrics', async () => {
    service.observeBullJob('email', 'completed');
    service.observeBullJob('email', 'failed');
    service.observeBullJob('order-expiration', 'completed');

    const text = await service.getMetrics();
    expect(text).toMatch(
      /bullmq_jobs_total\{[^}]*queue="email"[^}]*status="completed"\} 1/,
    );
    expect(text).toMatch(
      /bullmq_jobs_total\{[^}]*queue="email"[^}]*status="failed"\} 1/,
    );
  });

  it('exposes Prometheus text/plain format', async () => {
    service.observeHttp('GET', '/test', 200, 0.01);
    const text = await service.getMetrics();
    expect(text).toContain('# HELP');
    expect(text).toContain('# TYPE');
  });

  it('reset() cleans metrics (useful for tests)', async () => {
    service.observeHttp('GET', '/test', 200, 0.01);
    service.reset();
    const text = await service.getMetrics();

    expect(text).not.toMatch(/http_requests_total\{[^}]*\} [1-9]/);
  });
});
