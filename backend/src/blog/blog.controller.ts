import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { BlogService } from './blog.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateBlogPostDto, UpdateBlogPostDto } from './dto/blog-post.dto';

@Controller('api/v1/blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Public()
  @Get()
  async findAllPublished(
    @Query('page') page = '1',
    @Query('perPage') perPage = '10',
  ) {
    return await this.blogService.findAllPublished({
      page: parseInt(page, 10),
      perPage: parseInt(perPage, 10),
    });
  }

  @Roles('ADMIN')
  @Get('admin/all')
  async findAll() {
    return { data: await this.blogService.findAll() };
  }

  @Public()
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return { data: await this.blogService.findBySlug(slug) };
  }

  @Roles('ADMIN')
  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateBlogPostDto,
  ) {
    return {
      data: await this.blogService.create({ ...dto, authorId: user.id }),
    };
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return { data: await this.blogService.update(id, dto) };
  }

  @Roles('ADMIN')
  @Put(':id/publish')
  async publish(@Param('id') id: string) {
    return { data: await this.blogService.publish(id) };
  }

  @Roles('ADMIN')
  @Put(':id/unpublish')
  async unpublish(@Param('id') id: string) {
    return { data: await this.blogService.unpublish(id) };
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.blogService.remove(id);
    return { data: { message: 'Post removed' } };
  }
}
