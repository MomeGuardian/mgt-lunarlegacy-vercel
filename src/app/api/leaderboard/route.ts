import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 强制动态模式，防止缓存旧数据
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ✅ 核心逻辑：按 team_volume (业绩) 降序排列，取前 30 名
    const { data, error } = await supabase
      .from('users')
      .select('wallet, referrals_count, pending_reward, total_earned, team_volume')
      .order('team_volume', { ascending: false }) // 业绩高的在前面
      .limit(30);

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
