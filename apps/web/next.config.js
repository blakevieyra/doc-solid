const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@doc-solid/documents", "@doc-solid/storage"],
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  webpack: (config, { isServer }) => {
    // Dedupe React for client bundles only. Aliasing on the server breaks Next.js
    // LayoutRouterContext (useContext null) because RSC uses Next's bundled React.
    if (!isServer) {
      const rootModules = path.join(__dirname, "../../node_modules");
      config.resolve.alias = {
        ...config.resolve.alias,
        react: path.join(rootModules, "react"),
        "react-dom": path.join(rootModules, "react-dom"),
        "react/jsx-runtime": path.join(rootModules, "react/jsx-runtime"),
        "react/jsx-dev-runtime": path.join(rootModules, "react/jsx-dev-runtime"),
      };
    }
    return config;
  },
};

module.exports = nextConfig;
