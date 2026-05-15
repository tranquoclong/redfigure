import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PasswordPolicyService } from './password-policy.service';
import { HibpService } from './hibp.service';
import { GoogleOAuthService } from './google-oauth.service';
import { SecurityModule } from '../security/security.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    PassportModule,
    SecurityModule,
    SettingsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '15m') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PasswordPolicyService,
    HibpService,
    GoogleOAuthService,
  ],
  exports: [AuthService, PasswordPolicyService, JwtModule],
})
export class AuthModule {}
