import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

interface UnsubscribePayload {
  sub: string;
  purpose: 'unsubscribe-marketing';

  v?: number;
}

@Injectable()
export class UnsubscribeService {
  private readonly logger = new Logger(UnsubscribeService.name);
  private readonly storeUrl: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.storeUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'https://redfigure.com';
  }

  async generateToken(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { unsubscribeTokenVersion: true },
    });
    const payload: UnsubscribePayload = {
      sub: userId,
      purpose: 'unsubscribe-marketing',
      v: user?.unsubscribeTokenVersion ?? 0,
    };
    return this.jwt.sign(payload, { expiresIn: '365d' });
  }

  async buildUrl(userId: string): Promise<string> {
    const token = await this.generateToken(userId);
    return `${this.storeUrl}/unsubscribe?t=${token}`;
  }

  async buildOneClickUrl(userId: string): Promise<string> {
    const token = await this.generateToken(userId);
    const apiUrl =
      this.config.get<string>('PUBLIC_API_URL') ?? `${this.storeUrl}/api`;
    return `${apiUrl}/v1/users/unsubscribe/one-click?t=${token}`;
  }

  async consume(token: string): Promise<void> {
    let payload: UnsubscribePayload;
    try {
      payload = this.jwt.verify<UnsubscribePayload>(token);
    } catch {
      throw new BadRequestException('Invalid or expired link.');
    }

    if (payload.purpose !== 'unsubscribe-marketing') {
      throw new BadRequestException('Invalid link.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, unsubscribeTokenVersion: true },
    });
    if (!user) {
      throw new BadRequestException('User not found.');
    }

    const tokenV = payload.v ?? 0;
    if (tokenV !== user.unsubscribeTokenVersion) {
      this.logger.warn(
        `Unsubscribe token replay/version mismatch: token.v=${tokenV} vs user.v=${user.unsubscribeTokenVersion} (user=${payload.sub})`,
      );
      throw new BadRequestException(
        'Expired link. Your preferences have changed since this email was sent.',
      );
    }

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { emailMarketingOptOut: true },
    });

    this.logger.log(`User ${payload.sub} opted out of marketing emails`);
  }
}
