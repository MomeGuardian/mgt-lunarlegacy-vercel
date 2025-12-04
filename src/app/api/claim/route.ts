// src/app/api/claim/route.ts
import { supabase } from "@/lib/supabase";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction } from "@solana/spl-token";
import { NextRequest } from "next/server";

const REWARD_WALLET_SECRET = [146,144,106,181,118,127,45,134,180,42,167,10,72,102,206,6,36,28,
  76,251,237,28,133,62,10,112,61,80,36,163,144,93,61,220,252,226,184,145,113,251,255,126,78,
  200,154,200,183,219,232,186,226,55,134,146,169,131,157,228,123,70,46,55,251,226];
const TOKEN_MINT = new PublicKey("59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump");
const DECIMALS = 4;

const rewardWallet = Keypair.fromSecretKey(Uint8Array.from(REWARD_WALLET_SECRET));
const connection = new Connection("https://api.mainnet-beta.solana.com");

export async function POST(req: NextRequest) {
  const { wallet } = await req.json();
  if (!wallet) return new Response("No wallet", { status: 400 });

  // 查可领取数量
  const { data } = await supabase
    .from("users")
    .select("pending_reward")
    .eq("wallet", wallet)
    .single();

  const amount = Number(data?.pending_reward || 0);
  if (amount <= 0) return new Response("No reward", { status: 400 });

  try {
    const toATA = await getAssociatedTokenAddress(TOKEN_MINT, new PublicKey(wallet));
    const fromATA = await getAssociatedTokenAddress(TOKEN_MINT, rewardWallet.publicKey);

    const tx = new Transaction().add(
      createTransferInstruction(
        fromATA,
        toATA,
        rewardWallet.publicKey,
        BigInt(amount * Math.pow(10, DECIMALS))
      )
    );

    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = rewardWallet.publicKey;
    tx.sign(rewardWallet);

    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig);

    // 清零
    await supabase.from("users").update({ pending_reward: 0 }).eq("wallet", wallet);

    return new Response(JSON.stringify({ sig }), { status: 200 });
  } catch (err: any) {
    console.error(err);
    return new Response(err.message, { status: 500 });
  }
}
