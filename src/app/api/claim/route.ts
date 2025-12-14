import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DAILY_RATE = 0.002; // 0.2%

// 🌏 辅助函数：获取北京时间的日期字符串 (YYYY-MM-DD)
function getBeijingDateStr(date: Date) {
  // 1. 获取 UTC 时间戳
  const utc = date.getTime();
  // 2. 加上 8 小时时差 (8 * 60 * 60 * 1000)
  const beijingTime = new Date(utc + 8 * 60 * 60 * 1000);
  // 3. 返回 ISO 格式的前 10 位 (即日期部分)
  return beijingTime.toISOString().split('T')[0];
}

export async function POST(request: Request) {
  try {
    const { wallet } = await request.json();
    if (!wallet) return NextResponse.json({ error: 'Wallet required' }, { status: 400 });

    // 1. 查数据
    const { data: user } = await supabase
      .from('users')
      .select('locked_reward, last_vesting_time, total_claimed')
      .eq('wallet', wallet)
      .single();

    if (!user || user.locked_reward <= 0) {
        return NextResponse.json({ error: '暂无冻结奖励' }, { status: 400 });
    }

    // 2. 🕒 核心修改：使用北京时间 (UTC+8) 判断
    const now = new Date();
    // 如果没有上次时间，默认为 1970 年 (允许领取)
    const lastTime = user.last_vesting_time ? new Date(user.last_vesting_time) : new Date(0);

    // 获取“北京今天”和“上次领取的北京日期”
    const todayStr = getBeijingDateStr(now);
    const lastDayStr = getBeijingDateStr(lastTime);

    // 如果北京日期一样，说明今天已经领过了
    if (todayStr === lastDayStr) {
        return NextResponse.json({ error: '今日额度已领，请北京时间 00:00 后再来' }, { status: 400 });
    }

    // 3. 💰 计算释放金额
    let releaseAmount = user.locked_reward / 14;
    releaseAmount = Math.floor(releaseAmount * 10000) / 10000;

    if (releaseAmount <= 0) {
        return NextResponse.json({ error: '金额过小' }, { status: 400 });
    }

    // 4. 更新数据库 (存入当前时间作为记录)
    const { error } = await supabase.from('users').update({
        locked_reward: user.locked_reward - releaseAmount,
        total_claimed: (user.total_claimed || 0) + releaseAmount,
        last_vesting_time: now.toISOString() // 存的时候还是存标准时间，方便国际化
    }).eq('wallet', wallet);

    if (error) throw error;

    // 5. 记录流水
    await supabase.from('withdrawals').insert({
        wallet: wallet,
        amount: releaseAmount,
        status: 'pending',
        tx_hash: 'daily_vesting_bj'
    });

    return NextResponse.json({ 
        success: true, 
        message: `今日释放成功！(${releaseAmount} MGT)`,
        released: releaseAmount
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
