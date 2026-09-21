import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Vercel Cron gọi mỗi ngày (xem vercel.json) để Supabase gói Free luôn thấy
// có hoạt động và không tự "Pause" sau 7 ngày không ai dùng.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Nếu đặt CRON_SECRET trên Vercel, Vercel Cron tự gửi kèm Bearer token -> chỉ nhận request đó.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      // Không để treo lâu nếu Supabase đang pause / không phản hồi.
      global: { fetch: (url, opts) => fetch(url, { ...opts, signal: AbortSignal.timeout(8000) }) },
    }
  );

  const { error } = await supabase.from("staff").select("id").limit(1);
  if (error) {
    // Trả 500 để lịch sử Cron trên Vercel hiện đỏ khi Supabase có vấn đề.
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
