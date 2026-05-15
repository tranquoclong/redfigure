import { Test, TestingModule } from '@nestjs/testing';
import { AffiliateFraudDetectorService } from './affiliate-fraud-detector.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

describe('AffiliateFraudDetectorService', () => {
  let service: AffiliateFraudDetectorService;
  let prisma: any;
  let settings: any;

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    settings = {
      get: jest.fn(async (key: string) => {
        if (key === 'affiliate_session_flag_threshold') return '10';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateFraudDetectorService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settings },
      ],
    }).compile();

    service = module.get(AffiliateFraudDetectorService);
  });

  describe('scanSuspiciousSessions', () => {
    it('does not flag anything if no sessionId exceeds threshold', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const warn = jest.spyOn((service as any).logger, 'warn');

      const result = await service.scanSuspiciousSessions();

      expect(result.flaggedCount).toBe(0);
      expect(warn).not.toHaveBeenCalled();
    });

    it('flags session with >= threshold conversions in 24h', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          sessionId: 'session-fraud',
          affiliateId: 'aff-1',
          conversions: BigInt(12),
        },
        {
          sessionId: 'session-fraud-2',
          affiliateId: 'aff-2',
          conversions: BigInt(15),
        },
      ]);
      const warn = jest.spyOn((service as any).logger, 'warn');

      const result = await service.scanSuspiciousSessions();

      expect(result.flaggedCount).toBe(2);
      expect(warn).toHaveBeenCalledTimes(2);
      const firstCall = warn.mock.calls[0][0] as string;
      expect(firstCall).toContain('session-fraud');
      expect(firstCall).toContain('aff-1');
      expect(firstCall).toContain('12');
    });

    it('uses threshold from settings (default 10)', async () => {
      settings.get.mockResolvedValue('5');
      prisma.$queryRaw.mockResolvedValue([]);

      await service.scanSuspiciousSessions();

      const call = prisma.$queryRaw.mock.calls[0];

      const params = call.slice(1);
      expect(params).toContain(5);
    });

    it('handles invalid threshold setting fallback to 10', async () => {
      settings.get.mockResolvedValue('not-a-number');
      prisma.$queryRaw.mockResolvedValue([]);

      await service.scanSuspiciousSessions();

      const call = prisma.$queryRaw.mock.calls[0];
      const params = call.slice(1);
      expect(params).toContain(10);
    });
  });
});
