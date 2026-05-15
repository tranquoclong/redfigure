import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HolidaysService {
  constructor(private prisma: PrismaService) { }

  async create(dto: { date: string; name: string }) {
    try {
      return await this.prisma.holiday.create({
        data: { date: new Date(dto.date), name: dto.name },
      });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new ConflictException('Holiday already exists on this date');
      }
      throw err;
    }
  }

  async findAll() {
    return this.prisma.holiday.findMany({
      orderBy: { date: 'asc' },
    });
  }

  async remove(id: string) {
    const holiday = await this.prisma.holiday.findUnique({ where: { id } });
    if (!holiday) throw new NotFoundException('Holiday not found');
    return this.prisma.holiday.delete({ where: { id } });
  }

  async getHolidayDates(): Promise<Set<string>> {
    const holidays = await this.prisma.holiday.findMany({
      select: { date: true },
    });
    return new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
  }
}
