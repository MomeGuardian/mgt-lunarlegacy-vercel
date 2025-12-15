"use client";

import { FC, ReactNode, useMemo, useEffect, useState } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
// 👇 引入标准适配器 (OKX 会兼容这些协议)
import { 
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TrustWalletAdapter,
  CoinbaseWalletAdapter
} from "@solana/wallet-adapter-wallets";

import "@solana/wallet-adapter-react-ui/styles.css";

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // Quicknode 节点
  const endpoint = "https://rpc.mgt-token.company/b0b0db6c879f5ade13b4e2087c84f5d0c8f61739";

  // 🌟 1. 配置常用钱包
  // OKX App 内置浏览器通常会拦截 Phantom 或 Standard 协议，所以加上这些能增加识别率
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TrustWalletAdapter(),
      new CoinbaseWalletAdapter(),
    ],
    []
  );

  // 🌟 2. 核心修复：解决 Hydration Error (水合错误)
  // 这是一个“防崩锁”：确保只有在浏览器完全加载(mounted)之后，才渲染钱包组件
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ConnectionProvider 
        endpoint={endpoint}
        config={{ commitment: 'confirmed' }}
    >
      <WalletProvider 
        wallets={wallets} 
        autoConnect={true} 
      >
        <WalletModalProvider>
            {/* 👇 如果还没加载完(还在服务器)，就只渲染内容，不渲染钱包弹窗，防止报错 */}
            {mounted ? children : <div style={{ visibility: 'hidden' }}>{children}</div>}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );  
};

export default WalletContextProvider;
