/** @type {import('next').NextConfig} */
const nextConfig = {
  // node:sqlite is a Node.js builtin used by the data layer; keep server
  // components on the Node runtime (default) and never edge.
  serverExternalPackages: [],
};

export default nextConfig;
