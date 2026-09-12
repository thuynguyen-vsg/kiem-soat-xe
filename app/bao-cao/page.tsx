"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { SidebarNav, NavToggle, NavDrawer } from "@/app/components/Nav";

type Rec = {
  id: string;
  bien_so: string;
  loai: string;
  gio_hen: string | null;
  gio_vao: string | null;
  gio_ra: string | null;
  created_at: string;
  cvdv?: { ho_ten: string } | null;
};

const LOAI_LABEL: Record<string, string> = {
  hen: "Xe hẹn",
  vang_lai: "Vãng lai (thường)",
  giam_dinh: "Giám định bảo hiểm",
};

function refDate(r: Rec) {
  return new Date(r.gio_hen || r.gio_vao || r.created_at);
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function monthKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function fmtDateVN(key: string) {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}
function fmtMonthVN(key: string) {
  const [y, m] = key.split("-");
  return `Tháng ${Number(m)}/${y}`;
}
function emptyCounts() {
  return { hen: 0, vang_lai: 0, giam_dinh: 0 };
}

export default function BaoCaoPage() {
  const [rows, setRows] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("service_records")
      .select("id, bien_so, loai, gio_hen, gio_vao, gio_ra, created_at, cvdv:staff!cvdv_id(ho_ten)")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (!error) setRows((data as unknown as Rec[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ---------- 1. Xe hẹn trong ngày (theo ngày đang chọn) ----------
  const dayCounts = useMemo(() => {
    const c = emptyCounts();
    for (const r of rows) {
      if (dateKey(refDate(r)) === selectedDate) c[r.loai as keyof typeof c] = (c[r.loai as keyof typeof c] || 0) + 1;
    }
    return c;
  }, [rows, selectedDate]);
  const dayTotal = dayCounts.hen + dayCounts.vang_lai + dayCounts.giam_dinh;

  // ---------- 2. Báo cáo theo tháng ----------
  const monthRows = useMemo(() => {
    const map: Record<string, ReturnType<typeof emptyCounts>> = {};
    for (const r of rows) {
      const mk = monthKey(refDate(r));
      if (!map[mk]) map[mk] = emptyCounts();
      map[mk][r.loai as keyof ReturnType<typeof emptyCounts>] =
        (map[mk][r.loai as keyof ReturnType<typeof emptyCounts>] || 0) + 1;
    }
    return Object.entries(map)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // mới nhất trước
      .map(([mk, c]) => ({ mk, ...c, tong: c.hen + c.vang_lai + c.giam_dinh }));
  }, [rows]);
  const ytdTotal = useMemo(
    () =>
      monthRows.reduce(
        (acc, m) => ({
          hen: acc.hen + m.hen,
          vang_lai: acc.vang_lai + m.vang_lai,
          giam_dinh: acc.giam_dinh + m.giam_dinh,
          tong: acc.tong + m.tong,
        }),
        { hen: 0, vang_lai: 0, giam_dinh: 0, tong: 0 }
      ),
    [monthRows]
  );

  // ---------- 3. Xe tồn (chưa ra cổng) ----------
  const tonList = useMemo(() => {
    const now = new Date();
    return rows
      .filter((r) => !r.gio_ra && refDate(r).getTime() <= now.getTime()) // bỏ xe hẹn tương lai (chưa tới hạn)
      .map((r) => {
        const rd = refDate(r);
        const days = Math.max(0, Math.floor((now.getTime() - rd.getTime()) / 86400000));
        return { ...r, refDate: rd, days };
      })
      .sort((a, b) => a.refDate.getTime() - b.refDate.getTime());
  }, [rows]);

  const tonBucket = useMemo(() => {
    const b = { le3: 0, tu4den7: 0, tren7: 0 };
    for (const r of tonList) {
      if (r.days <= 3) b.le3++;
      else if (r.days <= 7) b.tu4den7++;
      else b.tren7++;
    }
    return b;
  }, [tonList]);

  const tonByDate = useMemo(() => {
    const map: Record<string, typeof tonList> = {};
    for (const r of tonList) {
      const k = dateKey(r.refDate);
      if (!map[k]) map[k] = [];
      map[k].push(r);
    }
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [tonList]);

  return (
    <div className="appShell">
      <SidebarNav />
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="mainArea">
        <div className="header">
          <div className="headerTop">
            <NavToggle onOpen={() => setNavOpen(true)} />
            <h1>📊 Báo Cáo Kiểm Soát Xe Ra Vào</h1>
          </div>
          <div className="meta">{loading ? "Đang tải..." : `${rows.length} bản ghi`}</div>
        </div>

        <div className="list">
          {/* ---------- Section 1 ---------- */}
          <div className="card" style={{ display: "block", cursor: "default" }}>
            <h3 style={{ marginTop: 0 }}>1. Xe hẹn trong ngày</h3>
            <input
              className="textInput"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ maxWidth: 220 }}
            />
            <div className="statGrid">
              <div className="statTile">
                <div className="statNum">{dayCounts.hen}</div>
                <div className="statLabel">Xe hẹn</div>
              </div>
              <div className="statTile">
                <div className="statNum">{dayCounts.vang_lai}</div>
                <div className="statLabel">Vãng lai (thường)</div>
              </div>
              <div className="statTile">
                <div className="statNum">{dayCounts.giam_dinh}</div>
                <div className="statLabel">Giám định bảo hiểm</div>
              </div>
              <div className="statTile highlight">
                <div className="statNum">{dayTotal}</div>
                <div className="statLabel">Tổng cộng</div>
              </div>
            </div>
          </div>

          {/* ---------- Section 2 ---------- */}
          <div className="card" style={{ display: "block", cursor: "default" }}>
            <h3 style={{ marginTop: 0 }}>2. Báo cáo theo tháng</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="reportTable">
                <thead>
                  <tr>
                    <th>Tháng</th>
                    <th>Xe hẹn</th>
                    <th>Vãng lai</th>
                    <th>Giám định</th>
                    <th>Tổng cộng</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRows.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "#999" }}>Chưa có dữ liệu</td></tr>
                  )}
                  {monthRows.map((m) => (
                    <tr key={m.mk}>
                      <td>{fmtMonthVN(m.mk)}</td>
                      <td>{m.hen}</td>
                      <td>{m.vang_lai}</td>
                      <td>{m.giam_dinh}</td>
                      <td style={{ fontWeight: 700 }}>{m.tong}</td>
                    </tr>
                  ))}
                  {monthRows.length > 0 && (
                    <tr className="totalRow">
                      <td>TỔNG CỘNG (YTD)</td>
                      <td>{ytdTotal.hen}</td>
                      <td>{ytdTotal.vang_lai}</td>
                      <td>{ytdTotal.giam_dinh}</td>
                      <td>{ytdTotal.tong}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---------- Section 3 ---------- */}
          <div className="card" style={{ display: "block", cursor: "default" }}>
            <h3 style={{ marginTop: 0 }}>3. Xe tồn (chưa ra cổng)</h3>
            <div className="statGrid">
              <div className="statTile highlight">
                <div className="statNum">{tonList.length}</div>
                <div className="statLabel">Tổng số xe tồn</div>
              </div>
              <div className="statTile">
                <div className="statNum">{tonBucket.le3}</div>
                <div className="statLabel">Tồn ≤ 3 ngày</div>
              </div>
              <div className="statTile warn">
                <div className="statNum">{tonBucket.tu4den7}</div>
                <div className="statLabel">Tồn 4–7 ngày</div>
              </div>
              <div className="statTile danger">
                <div className="statNum">{tonBucket.tren7}</div>
                <div className="statLabel">Tồn &gt; 7 ngày (cần chú ý)</div>
              </div>
            </div>

            {tonByDate.length === 0 ? (
              <div style={{ color: "#2e7d32", fontWeight: 600, fontSize: 14, marginTop: 8 }}>
                ✅ Không có xe nào tồn quá hạn chưa ra cổng.
              </div>
            ) : (
              <>
                <div className="fieldLabel">Chi tiết xe tồn theo ngày (ngày cũ nhất lên trước)</div>
                {tonByDate.map(([k, list]) => (
                  <div key={k} style={{ marginBottom: 12, textAlign: "left" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                      {fmtDateVN(k)} — {list.length} xe
                    </div>
                    <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7 }}>
                      {list.map((r) => (
                        <div key={r.id}>
                          {r.bien_so} ({r.cvdv?.ho_ten || LOAI_LABEL[r.loai] || r.loai}, tồn {r.days} ngày)
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
