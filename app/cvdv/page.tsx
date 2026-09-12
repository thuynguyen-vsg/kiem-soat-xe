"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { SidebarNav, NavToggle, NavDrawer } from "@/app/components/Nav";

type HenRecord = {
  id: string;
  bien_so: string;
  gio_hen: string;
  noi_dung: string | null;
  cvdv_id: string | null;
  cvdv?: { ho_ten: string } | null;
  gio_vao: string | null;
};

type PasteItem = {
  bien_so: string;
  gio_hen_raw: string;
  noi_dung: string;
  cvdv_ten: string;
  cvdv_id: string | null;
  matched: boolean;
};

function tomorrowDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function combineDateTime(dateStr: string, timeStr: string) {
  const [hh, mm] = timeStr.split(":").map(Number);
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0).toISOString();
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// input datetime-local mặc định giờ hiện tại, làm tròn lên 30 phút gần nhất
function defaultDateTimeLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + (30 - (d.getMinutes() % 30 || 30)));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CvdvPage() {
  const [staffList, setStaffList] = useState<{ id: string; ho_ten: string }[]>([]);
  const [hens, setHens] = useState<HenRecord[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [bienSo, setBienSo] = useState("");
  const [gioHen, setGioHen] = useState(defaultDateTimeLocal());
  const [noiDung, setNoiDung] = useState("");
  const [cvdvId, setCvdvId] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  const [pasteDate, setPasteDate] = useState(tomorrowDateStr());
  const [pasteText, setPasteText] = useState("");
  const [pastePreview, setPastePreview] = useState<PasteItem[]>([]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadHens = useCallback(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("service_records")
      .select("id, bien_so, gio_hen, noi_dung, cvdv_id, gio_vao, cvdv:staff!cvdv_id(ho_ten)")
      .eq("loai", "hen")
      .gte("gio_hen", start.toISOString())
      .order("gio_hen", { ascending: true });
    if (error) {
      showToast("❌ Lỗi tải danh sách: " + error.message);
      return;
    }
    setHens((data as unknown as HenRecord[]) || []);
  }, []);

  useEffect(() => {
    loadHens();
    supabase
      .from("staff")
      .select("id, ho_ten")
      .eq("vai_tro", "cvdv")
      .eq("active", true)
      .order("ho_ten")
      .then(({ data }) => setStaffList(data || []));
  }, [loadHens]);

  async function submitHen() {
    if (!bienSo.trim()) return showToast("❌ Vui lòng nhập biển số.");
    if (!gioHen) return showToast("❌ Vui lòng chọn giờ hẹn.");
    const { error } = await supabase.from("service_records").insert({
      bien_so: bienSo.toUpperCase().trim(),
      loai: "hen",
      gio_hen: new Date(gioHen).toISOString(),
      noi_dung: noiDung || null,
      cvdv_id: cvdvId || null,
    });
    if (error) return showToast("❌ " + error.message);
    showToast("✅ Đã đặt hẹn xe " + bienSo.toUpperCase());
    setBienSo("");
    setNoiDung("");
    setGioHen(defaultDateTimeLocal());
    loadHens();
  }

  function parsePaste() {
    const lines = pasteText.split("\n").map((l) => l.trim()).filter(Boolean);
    const items: PasteItem[] = [];
    for (const line of lines) {
      const cols = line.split("\t").map((c) => c.trim());
      let gioHenRaw = "", bienSo = "", noiDung = "", cvdvTen = "";
      if (cols.length >= 5) {
        // có cột STT ở đầu (dán cả cột A) -> bỏ qua
        [, gioHenRaw, bienSo, noiDung, cvdvTen] = cols;
      } else if (cols.length === 4) {
        [gioHenRaw, bienSo, noiDung, cvdvTen] = cols;
      } else {
        continue;
      }
      if (!/^\d{1,2}:\d{2}$/.test(gioHenRaw)) continue; // bỏ dòng tiêu đề / không hợp lệ
      if (!bienSo) continue;
      const staff = staffList.find(
        (s) => s.ho_ten.trim().toLowerCase() === cvdvTen.trim().toLowerCase()
      );
      items.push({
        bien_so: bienSo.toUpperCase(),
        gio_hen_raw: gioHenRaw,
        noi_dung: noiDung,
        cvdv_ten: cvdvTen,
        cvdv_id: staff ? staff.id : null,
        matched: !!staff || !cvdvTen,
      });
    }
    if (items.length === 0) return showToast("❌ Không đọc được dòng nào hợp lệ. Kiểm tra lại dữ liệu dán vào.");
    setPastePreview(items);
  }

  async function submitBulk() {
    if (pastePreview.length === 0) return;
    const payload = pastePreview.map((item) => ({
      bien_so: item.bien_so,
      loai: "hen",
      gio_hen: combineDateTime(pasteDate, item.gio_hen_raw),
      noi_dung: item.noi_dung || null,
      cvdv_id: item.cvdv_id,
    }));
    const { error } = await supabase.from("service_records").insert(payload);
    if (error) return showToast("❌ " + error.message);
    showToast(`✅ Đã lưu ${payload.length} lịch hẹn`);
    setPasteText("");
    setPastePreview([]);
    loadHens();
  }

  return (
    <div className="appShell">
      <SidebarNav />
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="mainArea">
      <div className="header">
        <div className="headerTop">
          <NavToggle onOpen={() => setNavOpen(true)} />
          <h1>📅 CVDV — Đặt Lịch Hẹn</h1>
        </div>
        <div className="meta">Xe có hẹn sẽ tự hiện ở màn hình Bảo vệ khi tới giờ</div>
      </div>

      <div className="list">
        <div className="card" style={{ display: "block", cursor: "default" }}>
          <div className="fieldLabel" style={{ marginTop: 0 }}>Biển số (bắt buộc)</div>
          <input className="textInput" placeholder="VD: 51K12345" value={bienSo} onChange={(e) => setBienSo(e.target.value)} />

          <div className="fieldLabel">Giờ hẹn (bắt buộc)</div>
          <input className="textInput" type="datetime-local" value={gioHen} onChange={(e) => setGioHen(e.target.value)} />

          <div className="fieldLabel">CVDV phụ trách</div>
          <select className="textInput" value={cvdvId} onChange={(e) => setCvdvId(e.target.value)}>
            <option value="">— Chưa rõ / chưa phân công —</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.ho_ten}</option>
            ))}
          </select>

          <div className="fieldLabel">Nội dung / Lý do</div>
          <input className="textInput" placeholder="VD: Bảo dưỡng định kỳ 10.000km" value={noiDung} onChange={(e) => setNoiDung(e.target.value)} />

          <button className="action" onClick={submitHen}>📅 ĐẶT LỊCH HẸN</button>
        </div>

        <div className="card" style={{ display: "block", cursor: "default" }}>
          <h3 style={{ marginTop: 0 }}>📋 Dán nhiều lịch hẹn (copy từ Google Sheet)</h3>

          <div className="fieldLabel" style={{ marginTop: 0 }}>Ngày hẹn áp dụng cho các dòng dán bên dưới</div>
          <input className="textInput" type="date" value={pasteDate} onChange={(e) => setPasteDate(e.target.value)} />

          <div className="fieldLabel">
            Dán dữ liệu (bôi đen 4 cột <b>Giờ Hẹn, Biển số, Nội dung, CVDV</b> trên Sheet rồi Ctrl+C, dán vào đây)
          </div>
          <textarea
            className="textInput"
            rows={5}
            style={{ fontFamily: "monospace", fontSize: 13, resize: "vertical" }}
            placeholder={"08:00\t51K08739\tPM90K\tĐào Đình Tính\n08:00\t51K01474\tPM70K\tLê Hồng Thông"}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <button className="action secondary" onClick={parsePaste}>🔍 Xem trước</button>

          {pastePreview.length > 0 && (
            <>
              <div className="fieldLabel">
                Xem trước ({pastePreview.length} dòng) — dòng nền cam ❓ là chưa khớp tên CVDV nào, kiểm tra kỹ trước khi lưu
              </div>
              <div style={{ maxHeight: 260, overflowY: "auto", textAlign: "left", border: "1px solid #eee", borderRadius: 10, marginBottom: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f2f2f2" }}>
                      <th style={{ padding: 6, textAlign: "left" }}>Biển số</th>
                      <th style={{ padding: 6, textAlign: "left" }}>Giờ</th>
                      <th style={{ padding: 6, textAlign: "left" }}>Nội dung</th>
                      <th style={{ padding: 6, textAlign: "left" }}>CVDV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastePreview.map((item, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #eee", background: item.matched ? "transparent" : "#fff3e0" }}>
                        <td style={{ padding: 6, fontWeight: 700 }}>{item.bien_so}</td>
                        <td style={{ padding: 6 }}>{item.gio_hen_raw}</td>
                        <td style={{ padding: 6 }}>{item.noi_dung}</td>
                        <td style={{ padding: 6 }}>{item.cvdv_ten}{!item.matched && item.cvdv_ten && " ❓"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="action" onClick={submitBulk}>✅ XÁC NHẬN &amp; LƯU {pastePreview.length} LỊCH HẸN</button>
            </>
          )}
        </div>

        <div className="fieldLabel" style={{ marginLeft: 6 }}>Lịch hẹn hôm nay & sắp tới</div>
        {hens.length === 0 && (
          <div className="card done" style={{ cursor: "default" }}>
            <div className="noidung">Chưa có xe nào đặt hẹn.</div>
          </div>
        )}
        {hens.map((h) => (
          <div key={h.id} className={"card " + (h.gio_vao ? "done" : "ok")} style={{ cursor: "default" }}>
            <div>
              <div className="bienso">{h.bien_so}</div>
              <div className="noidung">{h.noi_dung || ""}</div>
              {h.cvdv?.ho_ten && <div className="cvdv">CVDV: {h.cvdv.ho_ten}</div>}
              <div className="giohen">Hẹn: {fmtDateTime(h.gio_hen)}</div>
            </div>
            <div className={"badge " + (h.gio_vao ? "done" : "ok")}>
              {h.gio_vao ? "🚗 ĐÃ VÀO" : "⏳ CHỜ XE ĐẾN"}
            </div>
          </div>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}
