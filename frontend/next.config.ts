import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const IS_STAGING = process.env.NEXT_PUBLIC_ENV === "staging";

if (
  process.env.NODE_ENV === "production" &&
  !process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
) {
  throw new Error(
    "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY not set in production — generate with `openssl rand -base64 32` and set as build-arg + runtime environment",
  );
}

const nextConfig: NextConfig = {
  output: "standalone",
  staticPageGenerationTimeout: 180,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s3-hcm-r2.s3cloud.vn",
      },
      {
        protocol: "https",
        hostname: "cdn.redfigure.com",
      },
      {
        protocol: "https",
        hostname: "stg-cdn.redfigure.com",
      },
    ],
  },
  ...(IS_STAGING && {
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [
            {
              key: "X-Robots-Tag",
              value: "noindex, nofollow, noarchive, nosnippet",
            },
          ],
        },
      ];
    },
  }),
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
