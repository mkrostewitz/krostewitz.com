/** @type {import('next').NextConfig} */
const publicContactEmail = String(
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || process.env.APPLE_MAIL_TO || ""
).trim();

const nextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_CONTACT_EMAIL: publicContactEmail,
  },
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
