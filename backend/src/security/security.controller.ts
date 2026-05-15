import { Controller, Get, Delete, Param, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { SecurityService } from './security.service';

@Roles('ADMIN')
@Controller('api/v1/admin/security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) { }

  @Get('bans')
  async listBans() {
    return { data: await this.securityService.listBans() };
  }

  @Delete('bans/:ip')
  async unban(@Param('ip') ip: string) {
    await this.securityService.unbanIp(ip);
    return { data: { message: `IP ${ip} unbanned` } };
  }

  @Get('attempts')
  async getRecentAttempts(@Query('limit') limit?: string) {
    const l = parseInt(limit ?? '50', 10);
    return { data: await this.securityService.getRecentAttempts(l) };
  }
}
