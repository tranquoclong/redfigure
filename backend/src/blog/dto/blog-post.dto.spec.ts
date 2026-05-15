import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateBlogPostDto, UpdateBlogPostDto } from './blog-post.dto';

describe('BlogPost DTOs', () => {
  describe('CreateBlogPostDto', () => {
    it('accepts valid post', async () => {
      const dto = plainToInstance(CreateBlogPostDto, {
        title: 'How to paint miniatures',
        content: '<p>Content</p>',
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects empty title', async () => {
      const dto = plainToInstance(CreateBlogPostDto, {
        title: '',
        content: 'x',
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        minLength: expect.any(String),
      });
    });

    it('rejects title > 200 chars', async () => {
      const dto = plainToInstance(CreateBlogPostDto, {
        title: 'a'.repeat(201),
        content: 'x',
      });
      expect(await validate(dto)).not.toHaveLength(0);
    });

    it('rejects content > 100k chars (DoS)', async () => {
      const dto = plainToInstance(CreateBlogPostDto, {
        title: 'X',
        content: 'a'.repeat(100_001),
      });
      const errors = await validate(dto);
      expect(errors[0].constraints).toMatchObject({
        maxLength: expect.any(String),
      });
    });

    it('rejects excerpt > 500 chars', async () => {
      const dto = plainToInstance(CreateBlogPostDto, {
        title: 'X',
        content: 'x',
        excerpt: 'a'.repeat(501),
      });
      expect(await validate(dto)).not.toHaveLength(0);
    });
  });

  describe('UpdateBlogPostDto', () => {
    it('accepts empty object', async () => {
      const dto = plainToInstance(UpdateBlogPostDto, {});
      expect(await validate(dto)).toHaveLength(0);
    });

    it('accepts partial update', async () => {
      const dto = plainToInstance(UpdateBlogPostDto, { title: 'New title' });
      expect(await validate(dto)).toHaveLength(0);
    });
  });
});
