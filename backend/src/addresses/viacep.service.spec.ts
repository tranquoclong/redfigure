import { Test, TestingModule } from '@nestjs/testing';
import { ViaCepService } from './viacep.service';
import { BadRequestException } from '@nestjs/common';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ViaCepService', () => {
  let service: ViaCepService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ViaCepService],
    }).compile();

    service = module.get<ViaCepService>(ViaCepService);
    mockFetch.mockReset();
  });

  describe('lookup', () => {
    it('should return address data for valid ZIP', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          cep: '70000000',
          logradouro: 'street',
          bairro: 'ward',
          localidade: 'district',
          uf: 'province',
          erro: undefined,
        }),
      });

      const result = await service.lookup('70000000');

      expect(result).toEqual({
        postalCode: '70000000',
        street: 'street',
        ward: 'ward',
        district: 'district',
        province: 'province',
      });
    });

    it('should throw BadRequestException for invalid ZIP', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ erro: true }),
      });

      await expect(service.lookup('00000000')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for malformed ZIP', async () => {
      await expect(service.lookup('123')).rejects.toThrow(BadRequestException);
    });

    it('should return null fields when API fails (allow manual input)', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.lookup('01001000');

      expect(result).toBeNull();
    });
  });
});
