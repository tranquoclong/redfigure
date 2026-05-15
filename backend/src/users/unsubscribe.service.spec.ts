import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnsubscribeService } from './unsubscribe.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UnsubscribeService', () => {
  let service: UnsubscribeService;
  let jwt: JwtService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnsubscribeService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: new JwtService({ secret: 'test-secret' }),
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'https://redfigure.com') },
        },
      ],
    }).compile();

    service = module.get<UnsubscribeService>(UnsubscribeService);
    jwt = module.get<JwtService>(JwtService);
  });

  describe('generateToken', () => {
    it('returns JWT with sub=userId, purpose and current v of the user', async () => {
      prisma.user.findUnique.mockResolvedValue({ unsubscribeTokenVersion: 3 });
      const token = await service.generateToken('user-1');
      const decoded = jwt.verify(token) as Record<string, unknown>;
      expect(decoded.sub).toBe('user-1');
      expect(decoded.purpose).toBe('unsubscribe-marketing');
      expect(decoded.v).toBe(3);
    });

    it('token expires in 1 year', async () => {
      prisma.user.findUnique.mockResolvedValue({ unsubscribeTokenVersion: 0 });
      const token = await service.generateToken('user-1');
      const decoded = jwt.verify(token) as { exp: number; iat: number };
      const lifetimeSeconds = decoded.exp - decoded.iat;

      expect(lifetimeSeconds).toBeGreaterThan(31536000 - 86400);
      expect(lifetimeSeconds).toBeLessThan(31536000 + 86400);
    });

    it('user does not exist → token generated with v=0 (best-effort)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const token = await service.generateToken('ghost');
      const decoded = jwt.verify(token) as Record<string, unknown>;
      expect(decoded.v).toBe(0);
    });
  });

  describe('consume', () => {
    it('valid JWT with v match → updates user.emailMarketingOptOut=true', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        unsubscribeTokenVersion: 0,
      });
      const token = await service.generateToken('user-1');

      await service.consume(token);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailMarketingOptOut: true },
      });
    });

    it('JWT with wrong purpose → BadRequestException', async () => {
      const badToken = jwt.sign(
        { sub: 'user-1', purpose: 'something-else' },
        { expiresIn: '1y' },
      );
      await expect(service.consume(badToken)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('invalid JWT / broken signature → BadRequestException', async () => {
      await expect(service.consume('not-a-jwt')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('valid JWT but user no longer exists → BadRequestException', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ unsubscribeTokenVersion: 0 })
        .mockResolvedValueOnce(null);
      const token = await service.generateToken('non-existent-user');
      await expect(service.consume(token)).rejects.toThrow(BadRequestException);
    });

    it('JWT with stale v (user opted back IN after issuance) → BadRequestException', async () => {

      prisma.user.findUnique
        .mockResolvedValueOnce({ unsubscribeTokenVersion: 2 })
        .mockResolvedValueOnce({ id: 'user-1', unsubscribeTokenVersion: 3 });
      const token = await service.generateToken('user-1');
      await expect(service.consume(token)).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('consume is idempotent: calling twice with the same token works without error', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        unsubscribeTokenVersion: 0,
      });
      const token = await service.generateToken('user-1');

      await service.consume(token);
      await service.consume(token);

      expect(prisma.user.update).toHaveBeenCalledTimes(2);
    });
  });
});
