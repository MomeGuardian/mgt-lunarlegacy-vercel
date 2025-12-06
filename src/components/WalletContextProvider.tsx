// src/components/WalletContextProvider.tsx
"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { 
  PhantomWalletAdapter, 
  SolflareWalletAdapter, 
  TokenPocketWalletAdapter  // ← 正确 TokenPocket
} from "@solana/wallet-adapter-wallets";
import { OKXWalletAdapter } from "@okxconnect/solana-provider";  // ← 正确 OKX
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo } from "react";

export default function WalletContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      new OKXWalletAdapter(),           // 欧意 OKX
      new TokenPocketWalletAdapter(),   // TokenPocket
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
