import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CommissionRuleScope } from '@prisma/client';
import { AffiliateCommissionRulesService } from './affiliate-commission-rules.service';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import { UpdateCommissionRuleDto } from './dto/update-commission-rule.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Roles('ADMIN')
@Controller('api/v1/admin/affiliate-rules')
export class AdminCommissionRulesController {
  constructor(private readonly rules: AffiliateCommissionRulesService) {}

  @Get()
  async list(
    @Query('scope') scope?: CommissionRuleScope,
    @Query('page') page = '1',
    @Query('perPage') perPage = '50',
  ) {
    return this.rules.listRules({
      scope,
      page: parseInt(page, 10),
      perPage: parseInt(perPage, 10),
    });
  }

  @Post()
  async create(
    @Body() dto: CreateCommissionRuleDto,
    @CurrentUser() admin: { id: string },
  ) {
    const rule = await this.rules.createRule(
      {
        scope: dto.scope,
        rate: dto.rate,
        productId: dto.productId,
        tagId: dto.tagId,
        categoryId: dto.categoryId,
      },
      admin.id,
    );
    return { data: rule };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommissionRuleDto,
    @CurrentUser() admin: { id: string },
  ) {
    const rule = await this.rules.updateRule(id, dto.rate, admin.id);
    return { data: rule };
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    await this.rules.deleteRule(id, admin.id);
  }
}
