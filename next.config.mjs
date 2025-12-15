/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/rpc',
        destination: 'https://divine-orbital-dawn.solana-mainnet.quiknode.pro/b0b0db6c879f5ade13b4e2087c84f5d0c8f61739/',
      },
    ];
  },
};

export default nextConfig;
