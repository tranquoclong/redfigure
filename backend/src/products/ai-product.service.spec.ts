import { Test, TestingModule } from '@nestjs/testing';
import { AiProductService } from './ai-product.service';
import { SettingsService } from '../settings/settings.service';
import { AttributeMatcherService } from '../attributes/attribute-matcher.service';
import { BadRequestException } from '@nestjs/common';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('AiProductService', () => {
  let service: AiProductService;
  let settingsService: any;
  let matcherService: any;

  const mockGeminiResponse = {
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                title:
                  'Elf Warrior — 3D Fantasy Miniature | Arsenal Craft',
                slug: 'elf-warrior-3d-fantasy-miniature',
                shortDescription:
                  '3D miniature of an elf warrior in a dynamic pose with sword and shield. Exceptional detail in resin.',
                longDescription:
                  '<h2>Elf Warrior</h2><p>An amazing piece.</p>',
                longDescriptionSeo:
                  '<h2>Elf Warrior</h2><p>Detailed 3D miniature for board games and collecting.</p>',
                metaTitle: 'Elf Warrior — 3D Fantasy Miniature',
                seoKeywords: [
                  '3d fantasy miniature',
                  'elf warrior miniature',
                ],
                altText: [
                  '3D elf warrior miniature with sword in combat pose',
                ],
                imageTitles: ['Elf Warrior — 3D Fantasy Miniature'],
                imageDescriptions: [
                  '3D elf warrior miniature in resin, with sword and shield, in dynamic combat pose. Detailed piece for collectors and painters.',
                ],
                attributes: {
                  Style: ['Fantasy'],
                  Pose: ['Dynamic'],
                  Clothing: ['Armor'],
                  Accessory: ['Sword', 'Shield'],
                  Archetype: ['Warrior', 'Elf'],
                  Classification: ['SFW'],
                },
              }),
            },
          ],
        },
      },
    ],
  };

  beforeEach(async () => {
    settingsService = {
      get: jest.fn(),
      decrypt: jest.fn((v: string) => v),
    };

      matcherService = {
        matchAttributes: jest.fn().mockResolvedValue({
          matched: [
            {
              attributeValueId: 'val-1',
              attributeName: 'Style',
              value: 'Fantasy',
              confidence: 'exact',
            },
          ],
          unmatched: [
            {
              attributeName: 'Accessory',
              value: 'Shield',
              confidence: 'new',
            },
          ],
        }),
      };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiProductService,
        { provide: SettingsService, useValue: settingsService },
        { provide: AttributeMatcherService, useValue: matcherService },
      ],
    }).compile();

    service = module.get<AiProductService>(AiProductService);
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it('should throw when API key is not configured', async () => {
    settingsService.get.mockResolvedValue(null);

    await expect(
      service.generate({
        images: [Buffer.from('fake')],
        mimeTypes: ['image/jpeg'],
        name: 'Test',
        brandName: 'Brand',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should call Gemini API and return parsed result', async () => {
    settingsService.get
      .mockResolvedValueOnce('test-api-key')
      .mockResolvedValueOnce('gemini-2.5-flash')
      .mockResolvedValueOnce('You are a product expert');

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse,
    });

    const result = await service.generate({
      images: [Buffer.from('fake-image-data')],
      mimeTypes: ['image/jpeg'],
      name: 'Elf Warrior',
      brandName: 'Arsenal Craft',
      hint: 'fantasy warrior with sword',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callUrl = mockFetch.mock.calls[0][0];
    expect(callUrl).toContain('gemini-2.5-flash');
    expect(callUrl).toContain('generateContent');

    expect(result.title).toBe(
      'Elf Warrior — 3D Fantasy Miniature | Arsenal Craft',
    );
    expect(result.slug).toBe('elf-warrior-3d-fantasy-miniature');
    expect(result.longDescription).toContain('<h2>');
    expect(result.seoKeywords).toHaveLength(2);
    expect(result.altText).toHaveLength(1);
    expect(result.imageTitles).toHaveLength(1);
    expect(result.imageTitles[0]).toContain('Warrior');
    expect(result.imageDescriptions).toHaveLength(1);
    expect(result.imageDescriptions[0]).toContain('resin');

    expect(matcherService.matchAttributes).toHaveBeenCalledWith(
      mockGeminiResponse.candidates[0].content.parts[0].text
        ? JSON.parse(mockGeminiResponse.candidates[0].content.parts[0].text)
            .attributes
        : undefined,
    );
    expect(result.matchedAttributes).toHaveLength(1);
    expect(result.unmatchedAttributes).toHaveLength(1);
  });

  it('should retry once on invalid JSON from Gemini', async () => {
    settingsService.get
      .mockResolvedValueOnce('key')
      .mockResolvedValueOnce('model')
      .mockResolvedValueOnce('prompt');

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'not valid json' }] } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeminiResponse,
      });

    const result = await service.generate({
      images: [Buffer.from('fake')],
      mimeTypes: ['image/jpeg'],
      name: 'Test',
      brandName: 'Brand',
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.title).toBeDefined();
  });

  it('should throw when Gemini API returns error', async () => {
    settingsService.get
      .mockResolvedValueOnce('key')
      .mockResolvedValueOnce('model')
      .mockResolvedValueOnce('prompt');

    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => '{"error":"rate limit"}',
    });

    await expect(
      service.generate({
        images: [Buffer.from('fake')],
        mimeTypes: ['image/jpeg'],
        name: 'Test',
        brandName: 'Brand',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should use default model when ai_model not configured', async () => {
    settingsService.get
      .mockResolvedValueOnce('key')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('prompt');

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse,
    });

    await service.generate({
      images: [Buffer.from('fake')],
      mimeTypes: ['image/jpeg'],
      name: 'Test',
      brandName: 'Brand',
    });

    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('gemini-2.5-flash');
  });
});
