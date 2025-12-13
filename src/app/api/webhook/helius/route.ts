import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 你的代币合约 (MGT)
const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";

// 🔧 配置：如果 API 查不到价格，就用这个默认价格 (用于测试或预售阶段)
const DEFAULT_TEST_PRICE = 0.00011988; // 👈 你可以改成你的预售价格，比如 0.02

// 💰 1. 获取 MGT 价格 (带保底机制)
async function getMgtPrice() {
  try {
    const response = await fetch(`https://api.jup.ag/price/v2?ids=${MGT_MINT}`);
    const data = await response.json();
    const price = data.data?.[MGT_MINT]?.price;
    
    if (price) {
      console.log(`✅ Jupiter API 获取价格成功: $${price}`);
      return parseFloat(price);
    } else {
      console.warn(`⚠️ Jupiter 未返回价格，使用默认测试价格: $${DEFAULT_TEST_PRICE}`);
      return DEFAULT_TEST_PRICE; // <--- 保底
    }
  } catch (error) {
    console.error("获取价格失败，使用默认值:", error);
    return DEFAULT_TEST_PRICE; // <--- 报错也保底
  }
}

export async function POST(request: Request) {
  try {
    // 1. 安全验证
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (secret !== process.env.HELIUS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 解析数据
    const body = await request.json();
    if (!body || !Array.isArray(body)) return NextResponse.json({ message: 'No transactions' });

    // 3. 初始化 Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 4. 获取计算用的价格
    const calcPrice = await getMgtPrice();

    for (const tx of body) {
      if (tx.transactionError) continue;

      const signature = tx.signature;
      const buyer = tx.feePayer;

      // 查重
      const { data: exist } = await supabase.from('transactions').select('signature').eq('signature', signature).single();
      if (exist) continue;

      // 检查是否买入 MGT
      const transfers = tx.tokenTransfers || [];
      const mgtReceived = transfers.find((t: any) => t.mint === MGT_MINT && t.toUserAccount === buyer);

      if (!mgtReceived) continue;

      const buyAmount = parseFloat(mgtReceived.tokenAmount); // 买入数量
      
      // 💵 计算 USDT 价值 (业绩)
      const usdValue = buyAmount * calcPrice;
      
      console.log(`🚀 监测到买入: ${buyer} +${buyAmount} MGT (计算价格: $${calcPrice}, 总值: $${usdValue.toFixed(2)})`);

      // 5. 查找上级
      const { data: user } = await supabase.from('users').select('referrer').eq('wallet', buyer).single();

      if (user?.referrer) {
        const referrer = user.referrer;
        const reward = buyAmount * 0.05; // 5% 返现 (币)

        console.log(`✅ 归属上级: ${referrer}, 增加业绩: $${usdValue.toFixed(2)}`);

        // A. 记录流水
        await supabase.from('transactions').insert({
            signature,
            buyer,
            referrer,
            token_amount: buyAmount,
            reward_amount: reward,
            usdt_value: usdValue
        });

        // B. 更新上级数据 (待领 + 总赚)
        const { data: refData } = await supabase
            .from('users')
            .select('pending_reward, total_earned')
            .eq('wallet', referrer)
            .single();
        
        if (refData) {
            const newReward = (refData.pending_reward || 0) + reward;
            const newTotalEarned = (refData.total_earned || 0) + reward;
            
            await supabase.from('users').update({
                pending_reward: newReward,
                total_earned: newTotalEarned
            }).eq('wallet', referrer);

            // C. 🔥 使用 RPC 更新团队业绩 (防冲突)
            // 确保你之前在 SQL Editor 运行过 create function increment_team_volume...
            const { error: rpcError } = await supabase.rpc('increment_team_volume', {
                wallet_address: referrer,
                amount_to_add: usdValue
            });

            if (rpcError) {
                console.error("❌ RPC 更新业绩失败:", rpcError);
            } else {
                console.log("✅ 团队业绩更新成功");
            }
        }
      } else {
        // 无上级
        await supabase.from('transactions').insert({
            signature,
            buyer,
            token_amount: buyAmount,
            reward_amount: 0,
            usdt_value: usdValue
        });
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
