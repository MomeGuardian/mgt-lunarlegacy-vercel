/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/rpc',
        // 👇 目标地址：QuickNode 原生链接 + 正确的 b0b0 密钥
        destination: 'https://divine-orbital-dawn.solana-mainnet.quiknode.pro/b0b0db6c879f5ade13b4e2087c84f5d0c8f61739/',
      },
    ];
  },
};

export default nextConfig;