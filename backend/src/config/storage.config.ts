import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'auto',
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  bucket: process.env.S3_BUCKET ?? 'miniatures-bucket',
  cdnUrl: process.env.CDN_URL,
}));
