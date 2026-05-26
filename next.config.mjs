/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.cyc-prien.de",
        pathname: "/_data/webcam.jpg",
      },
    ],
  },
  reactCompiler: true,
};

export default nextConfig;
