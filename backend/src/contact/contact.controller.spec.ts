import { Test, TestingModule } from '@nestjs/testing';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

describe('ContactController', () => {
  let controller: ContactController;
  let service: jest.Mocked<ContactService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactController],
      providers: [
        {
          provide: ContactService,
          useValue: { submit: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(ContactController);
    service = module.get(ContactService);
  });

  const baseDto = {
    name: 'John',
    email: 'john@x.com',
    message: 'Message with more than ten characters.',
    turnstileToken: 'cf-tok',
    acceptLgpd: true,
  };

  describe('POST /api/v1/contact', () => {
    it('delegates to service with DTO + IP + UA, wraps in { data }', async () => {
      service.submit.mockResolvedValue({ ok: true });
      const fakeReq = {
        ip: '203.0.113.5',
        headers: { 'user-agent': 'CustomAgent/1.0' },
      } as unknown as Parameters<typeof controller.submit>[1];

      const result = await controller.submit(baseDto, fakeReq);

      expect(service.submit).toHaveBeenCalledWith({
        ...baseDto,
        honeypot: undefined,
        ipAddress: '203.0.113.5',
        userAgent: 'CustomAgent/1.0',
      });
      expect(result).toEqual({ data: { ok: true } });
    });

    it('passes honeypot field to service', async () => {
      service.submit.mockResolvedValue({ ok: true });
      await controller.submit({ ...baseDto, website: 'bot-fill' }, {
        ip: '1.1.1.1',
        headers: {},
      } as unknown as Parameters<typeof controller.submit>[1]);
      expect(service.submit).toHaveBeenCalledWith(
        expect.objectContaining({ honeypot: 'bot-fill' }),
      );
    });

    it('falls back to x-forwarded-for first hop when req.ip is missing', async () => {
      service.submit.mockResolvedValue({ ok: true });
      await controller.submit(baseDto, {
        ip: undefined,
        headers: { 'x-forwarded-for': '198.51.100.9, 10.0.0.1' },
      } as unknown as Parameters<typeof controller.submit>[1]);
      expect(service.submit).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: '198.51.100.9' }),
      );
    });

    it('handles missing user-agent header gracefully', async () => {
      service.submit.mockResolvedValue({ ok: true });
      await controller.submit(baseDto, {
        ip: '1.1.1.1',
        headers: {},
      } as unknown as Parameters<typeof controller.submit>[1]);
      expect(service.submit).toHaveBeenCalledWith(
        expect.objectContaining({ userAgent: undefined }),
      );
    });
  });
});
