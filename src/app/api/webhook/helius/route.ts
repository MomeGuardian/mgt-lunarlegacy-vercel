import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 你的代币合约地址 (MGT)
const MGT_TOKEN_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";

export async function POST(request: Request) {
  try {
    // 1. 简单的权限验证 (防止恶意调用)
    // 我们会在 Helius 后台配置 URL 时加上 ?secret=...
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (secret !== process.env.HELIUS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 获取 Helius 发来的数据
    const body = await request.json();
    
    // Helius 发来的是一个数组，可能包含多笔交易
    if (!body || !Array.isArray(body)) {
      return NextResponse.json({ message: 'No transactions found' });
    }

    // 3. 初始化 Supabase (服务端特权模式)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // 必须用 Service Key
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 4. 遍历处理每一笔交易
    for (const tx of body) {
      // 只处理成功的交易
      if (tx.transactionError) continue;

      // 🔍 核心解析逻辑：这是否是一笔 MGT 的买入交易？
      // Helius "Enhanced Transaction" 类型通常是 SWAP
      if (tx.type !== 'SWAP') continue;

      const signature = tx.signature;
      const buyer = tx.feePayer; // 通常 feePayer 就是发起交易的人(买家)

      // 检查这笔交易是否已经被处理过 (幂等性)
      const { data: exist } = await supabase.from('transactions').select('signature').eq('signature', signature).single();
      if (exist) continue;

      // 分析 Token 转账：看买家是否收到了 MGT
      const tokenTransfers = tx.tokenTransfers || [];
      const mgtTransfer = tokenTransfers.find((t: any) => 
        t.mint === MGT_TOKEN_MINT && t.toUserAccount === buyer
      );

      // 如果没找到 MGT 的转入，说明不是买入 MGT，跳过
      if (!mgtTransfer) continue;

      const buyAmount = parseFloat(mgtTransfer.tokenAmount); // 买家获得的 MGT 数量
      
      console.log(`🔍 检测到买入: ${buyer} 买了 ${buyAmount} MGT`);

      // 5. 查找买家是否有上级
      const { data: user } = await supabase.from('users').select('referrer').eq('wallet', buyer).single();

      if (user?.referrer) {
        // 💰 计算返现：5%
        const reward = buyAmount * 0.05;
        const referrer = user.referrer;

        console.log(`✅ 发放奖励: 上级 ${referrer} 获得 ${reward} MGT`);

        // A. 更新上级余额 (原子操作：直接累加)
        // 注意：Supabase 没有直接的 increment，我们需要调用 RPC 或者先读后写
        // 这里为了简单，我们用 RPC 函数 (稍后在 SQL 里创建) 或者直接用 upsert 逻辑
        // 我们先用简单的：查 -> 改 -> 存 (并发量不大时没问题)
        
        const { data: refUser } = await supabase.from('users').select('pending_reward, team_volume').eq('wallet', referrer).single();
        
        if (refUser) {
            const newReward = (refUser.pending_reward || 0) + reward;
            const newVolume = (refUser.team_volume || 0) + buyAmount; // 业绩暂且按代币数量算，或者你可以按 USDT 算

            await supabase.from('users').update({
                pending_reward: newReward,
                team_volume: newVolume
            }).eq('wallet', referrer);
        }

        // B. 记录交易流水
        await supabase.from('transactions').insert({
            signature: signature,
            buyer: buyer,
            referrer: referrer,
            token_amount: buyAmount,
            reward_amount: reward,
            status: 'processed'
        });

      } else {
        console.log(`🤷‍♂️ 无上级: ${buyer} 没有绑定上级，无人获得返现`);
        // 也要记录流水，防止重复处理
        await supabase.from('transactions').insert({
            signature: signature,
            buyer: buyer,
            token_amount: buyAmount,
            reward_amount: 0,
            status: 'processed_no_referrer'
        });
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}