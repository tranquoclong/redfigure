import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.BACKEND_PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  siteUrl: process.env.SITE_URL ?? 'https://redfigure.com',
}));
