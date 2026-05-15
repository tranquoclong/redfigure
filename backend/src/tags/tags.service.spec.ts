import { Test, TestingModule } from '@nestjs/testing';
import { TagsService } from './tags.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException } from '@nestjs/common';

describe('TagsService', () => {
  let service: TagsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        {
          provide: PrismaService,
          useValue: {
            tag: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<TagsService>(TagsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create tag with auto-slug', async () => {
      (prisma.tag.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.tag.create as jest.Mock).mockResolvedValue({
        id: 'tag1',
        name: 'Pin Up',
        slug: 'pin-up',
        color: '#FF0000',
      });

      const result = await service.create({ name: 'Pin Up', color: '#FF0000' });

      expect(result.slug).toBe('pin-up');
    });

    it('should throw ConflictException for duplicate name', async () => {
      (prisma.tag.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing',
      });

      await expect(service.create({ name: 'Pin Up' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return active tags', async () => {
      (prisma.tag.findMany as jest.Mock).mockResolvedValue([
        { id: 'tag1', name: 'Pin Up', slug: 'pin-up' },
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
    });
  });
});
