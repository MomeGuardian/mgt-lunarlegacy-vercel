"use client";

import { FC, ReactNode, useMemo, useEffect, useState, useCallback } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletError } from "@solana/wallet-adapter-base";
import { 
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  // 删除了其他不常用的，只留兼容性最好的
} from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // ✅ 1. 使用 QuickNode 原生链接 (手机端握手最快，不易卡顿)
  const endpoint = "https://divine-orbital-dawn.solana-mainnet.quiknode.pro/b0b0db6c879f5ade13b4e2087c84f5d0c8f61739/";

  // ✅ 2. 钱包适配器 (OKX 会自动伪装成 Phantom，所以这一个就够了)
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  // 错误处理：静默失败，不要弹窗吓用户
  const onError = useCallback((error: WalletError) => {
    console.error("Wallet error:", error);
  }, []);

  // 🌟🌟🌟 3. 核心大招：延迟挂载 (给 OKX 注入的时间) 🌟🌟🌟
  // 很多时候 OKX 还没准备好，页面就渲染了，导致连不上。
  // 我们强制让页面“等” 500毫秒，等 OKX 注入完毕后再启动钱包组件。
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 500); // 👈 这里延迟 500ms，是解决 OKX 进不去的关键！

    return () => clearTimeout(timer);
  }, []);

  return (
    <ConnectionProvider 
        endpoint={endpoint}
        config={{ commitment: 'confirmed' }}
    >
      <WalletProvider 
        wallets={wallets} 
        autoConnect={true} // 👈 开启记忆功能，只要连过一次，下次自动连
        onError={onError}
      >
        <WalletModalProvider>
            {/* 加载中显示的界面 */}
            {mounted ? children : (
                <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white">
                     {/* 搞个简单的 Loading 动画，缓解等待焦虑 */}
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <div className="text-xs text-gray-400 font-mono">Initializing Wallet...</div>
                </div>
            )}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );  
};

export default WalletContextProvider;
