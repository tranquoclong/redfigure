import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaOrphanScanService } from './media-orphan-scan.service';

@Module({
  imports: [ConfigModule],
  controllers: [MediaController],
  providers: [
    {
      provide: 'S3_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new S3Client({
          region: configService.get<string>('S3_REGION', 'auto'),
          endpoint: configService.get<string>('S3_ENDPOINT'),
          credentials: {
            accessKeyId: configService.get<string>('S3_ACCESS_KEY_ID', ''),
            secretAccessKey: configService.get<string>(
              'S3_SECRET_ACCESS_KEY',
              '',
            ),
          },
          forcePathStyle: true,
        });
      },
    },
    {
      provide: 'MEDIA_CONFIG',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        bucket: configService.get<string>('S3_BUCKET', 'miniatures-bucket'),
        cdnUrl: configService.get<string>(
          'CDN_URL',
          `${configService.get<string>('S3_ENDPOINT', '')}/${configService.get<string>('S3_BUCKET', 'miniatures-bucket')}`,
        ),
      }),
    },
    MediaService,
    MediaOrphanScanService,
  ],
  exports: [MediaService],
})
export class MediaModule {}
