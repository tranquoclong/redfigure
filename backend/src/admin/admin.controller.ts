import { Controller, Get } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';

@Roles('ADMIN')
@Controller('api/v1/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  async getDashboard() {
    return { data: await this.adminService.getDashboardStats() };
  }

  @Get('orders-by-status')
  async getOrdersByStatus() {
    return { data: await this.adminService.getOrdersByStatus() };
  }
}
