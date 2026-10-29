import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  // react-pdf/fontkit must run unbundled; its fonts ship with the route.
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: { "/app/tables/pdf": ["./lib/pdf/fonts/**"] },
  experimental: { serverActions: { bodySizeLimit: "22mb" }, globalNotFound: true },
  images: {
    remotePatterns: supabaseUrl
      ? [{ protocol: new URL(supabaseUrl).protocol.replace(":", "") as "http" | "https", hostname: new URL(supabaseUrl).hostname, pathname: "/storage/v1/**" }]
      : [],
  },
};

export default withNextIntl(nextConfig);
