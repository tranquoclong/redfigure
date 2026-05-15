import { Test, TestingModule } from '@nestjs/testing';
import { HibpService } from './hibp.service';

describe('HibpService', () => {
  let service: HibpService;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [HibpService],
    }).compile();

    service = module.get<HibpService>(HibpService);
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  const PWD_PREFIX = '5BAA6';
  const PWD_SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';

  it('sends only the first 5 SHA-1 characters (k-anonymity)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(`${PWD_SUFFIX}:9876543`),
    });

    await service.isPwned('password');

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.pwnedpasswords.com/range/${PWD_PREFIX}`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns true when the suffix appears in the API list (leaked password)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          `${PWD_SUFFIX}:9876543\nXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX:5`,
        ),
    });

    const pwned = await service.isPwned('password');
    expect(pwned).toBe(true);
  });

  it('returns false when the suffix does not appear in the list', async () => {

    fetchMock.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:3\nBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB:7',
        ),
    });

    const pwned = await service.isPwned('password');
    expect(pwned).toBe(false);
  });

  it('fail-open: if HIBP API is down, return false (do not block registration)', async () => {
    fetchMock.mockRejectedValue(new Error('ETIMEDOUT'));

    const pwned = await service.isPwned('password');
    expect(pwned).toBe(false);
  });

  it('fail-open: if API returns non-200, return false', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve(''),
    });

    const pwned = await service.isPwned('password');
    expect(pwned).toBe(false);
  });

  it('suffix comparison is case-insensitive (HIBP returns uppercase)', async () => {
    const lowerSuffix = PWD_SUFFIX.toLowerCase();
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(`${lowerSuffix}:100`),
    });

    const pwned = await service.isPwned('password');
    expect(pwned).toBe(true);
  });
});
