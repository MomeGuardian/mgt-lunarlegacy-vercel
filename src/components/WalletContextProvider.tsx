"use client";

import { FC, ReactNode, useMemo, useEffect, useState, useCallback } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletError } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
  
  // ✅✅✅ 核心修改：改回你的伪装域名！✅✅✅
  // 因为你已经关掉了 Referrer 白名单，现在这个域名既能绕过墙，又不会报错了！
  // 这才是解决中国区卡顿的终极钥匙。
  const endpoint = "https://rpc.mgt-token.company/b0b0db6c879f5ade13b4e2087c84f5d0c8f61739/";

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  const onError = useCallback((error: WalletError) => {
    console.error("Wallet error:", error);
  }, []);

  // 延迟挂载：给 OKX 手机端一点反应时间
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 500); 
    return () => clearTimeout(timer);
  }, []);

  return (
    <ConnectionProvider 
        endpoint={endpoint}
        config={{ commitment: 'confirmed' }}
    >
      <WalletProvider 
        wallets={wallets} 
        autoConnect={true} 
        onError={onError}
      >
        <WalletModalProvider>
            {mounted ? children : (
                <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <div className="text-xs text-gray-400 font-mono">Initializing MGT...</div>
                </div>
            )}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );  
};

export default WalletContextProvider;
