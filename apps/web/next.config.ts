import "@toolora/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  output: "standalone",
  experimental: {
    turbopackRustReactCompiler: true,
  },
};

export default nextConfig;
