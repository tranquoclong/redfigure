import {
  Controller,
  Get,
  Put,
  Post,
  HttpCode,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { UnsubscribeService } from './unsubscribe.service';
import { SettingsService } from '../settings/settings.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateEmailPreferencesDto } from './dto/email-preferences.dto';
import { UnsubscribeDto } from './dto/unsubscribe.dto';
import { SetBusinessSettingsDto } from './dto/set-business-settings.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

function assertStringOrUndefined(
  value: unknown,
  name: string,
): asserts value is string | undefined {
  if (value === undefined) return;
  if (typeof value !== 'string') {
    throw new BadRequestException(`${name} must be a single string`);
  }
}

@Controller('api/v1/users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly unsubscribeService: UnsubscribeService,
    private readonly settings: SettingsService,
  ) { }

  @Roles('ADMIN')
  @Get('admin/business-settings')
  async getBusinessSettings() {
    const enabled = await this.settings.getAcceptBusinessCustomers();
    return { data: { enabled } };
  }

  @Roles('ADMIN')
  @Put('admin/business-settings')
  async setBusinessSettings(@Body() body: SetBusinessSettingsDto) {
    await this.settings.setAcceptBusinessCustomers(body.enabled);
    return { data: { enabled: body.enabled } };
  }

  @Roles('ADMIN')
  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('perPage') perPage = '20',
    @Query('search') search?: string,
  ) {

    assertStringOrUndefined(page, 'page');
    assertStringOrUndefined(perPage, 'perPage');
    assertStringOrUndefined(search, 'search');

    if (typeof search === 'string' && search.length > 100) {
      throw new BadRequestException('search term too long');
    }

    const parsedPerPage = Math.max(
      1,
      Math.min(parseInt(perPage, 10) || 20, 100),
    );
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);

    return await this.usersService.findAll({
      page: parsedPage,
      perPage: parsedPerPage,
      search,
    });
  }

  @Get('me')
  async getMinimalProfile(@CurrentUser() user: { id: string }) {
    const profile = await this.usersService.getMinimalProfile(user.id);
    return { data: profile };
  }

  @Get('me/profile')
  async getFullProfile(@CurrentUser() user: { id: string }) {
    const profile = await this.usersService.getProfile(user.id);
    return { data: profile };
  }

  @Put('me')
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateProfile(user.id, dto);
    return { data: updated };
  }

  @Put('me/password')
  async changePassword(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(user.id, dto);
    return { data: { message: 'Password changed successfully' } };
  }

  @Put('me/email-preferences')
  async updateEmailPreferences(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateEmailPreferencesDto,
  ) {
    const updated = await this.usersService.updateEmailPreferences(
      user.id,
      dto,
    );
    return { data: updated };
  }

  @Public()
  @Post('unsubscribe')
  @HttpCode(200)
  async unsubscribe(@Body() dto: UnsubscribeDto) {
    await this.unsubscribeService.consume(dto.token);
    return { data: { message: 'Unsubscribed from marketing emails' } };
  }

  @Public()
  @Throttle({
    short: { limit: 10, ttl: 60_000 },
    long: { limit: 100, ttl: 60 * 60 * 1000 },
  })
  @Post('unsubscribe/one-click')
  @HttpCode(200)
  async unsubscribeOneClick(
    @Query('t') token: string,
    @Body('List-Unsubscribe') listUnsubscribe?: string,
  ) {
    if (!token) {
      throw new BadRequestException('Token required');
    }

    if (listUnsubscribe !== 'One-Click') {
      throw new BadRequestException('Invalid one-click payload (RFC 8058)');
    }
    await this.unsubscribeService.consume(token);
    return { data: { message: 'Unsubscribed' } };
  }

  @Roles('ADMIN')
  @Get(':id/detail')
  async adminGetUser(@Param('id') id: string) {
    const user = await this.usersService.adminGetUser(id);
    return { data: user };
  }

  @Roles('ADMIN')
  @Get(':id/addresses')
  async adminGetUserAddresses(@Param('id') id: string) {
    const addresses = await this.usersService.adminGetUserAddresses(id);
    return { data: addresses };
  }

  @Roles('ADMIN')
  @Get(':id/orders')
  async adminGetUserOrders(@Param('id') id: string) {
    const orders = await this.usersService.adminGetUserOrders(id);
    return { data: orders };
  }

  @Roles('ADMIN')
  @Put(':id')
  async adminUpdateUser(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() admin: { id: string },
  ) {
    const updated = await this.usersService.adminUpdateUser(id, dto, admin.id);
    return { data: updated };
  }

  @Roles('ADMIN')
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  @Put(':id/role')
  async changeRole(
    @Param('id') id: string,
    @Body() dto: ChangeUserRoleDto,
    @CurrentUser() admin: { id: string },
  ) {
    const updated = await this.usersService.changeUserRole(
      id,
      dto.role,
      admin.id,
      dto.reason,
    );
    return { data: updated };
  }

  @Roles('ADMIN')
  @Get(':id/role-changes')
  async getUserRoleChanges(@Param('id') id: string) {
    return { data: await this.usersService.listUserRoleChanges(id) };
  }
}
