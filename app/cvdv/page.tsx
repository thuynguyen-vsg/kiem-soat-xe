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

type GridRow = { gioHen: string; bienSo: string; noiDung: string; cvdvId: string };
function emptyGridRow(): GridRow {
  return { gioHen: "", bienSo: "", noiDung: "", cvdvId: "" };
}
function makeGridRows(n: number): GridRow[] {
  return Array.from({ length: n }, emptyGridRow);
}

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

  const [gridDate, setGridDate] = useState(tomorrowDateStr());
  const [gridRows, setGridRows] = useState<GridRow[]>(() => makeGridRows(6));

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

  function updateCell(idx: number, field: keyof GridRow, value: string) {
    setGridRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }
  function addGridRow() {
    setGridRows((prev) => [...prev, emptyGridRow()]);
  }
  function removeGridRow(idx: number) {
    setGridRows((prev) => prev.filter((_, i) => i !== idx));
  }

  // Dán cả khối (copy từ Google Sheet) vào ô "Giờ" của 1 dòng -> tự điền
  // dòng đó + các dòng tiếp theo (Giờ, Biển số, Nội dung, CVDV theo tên).
  function handleGridPaste(e: React.ClipboardEvent<HTMLInputElement>, startIdx: number) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return; // dán 1 giá trị -> để trình duyệt tự xử lý
    e.preventDefault();
    const lines = text.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim().length > 0);
    setGridRows((prev) => {
      const next = [...prev];
      lines.forEach((line, li) => {
        const cols = line.split("\t").map((c) => c.trim());
        let gioHen = "", bienSo = "", noiDung = "", cvdvTen = "";
        if (cols.length >= 5) [, gioHen, bienSo, noiDung, cvdvTen] = cols; // có cột STT
        else [gioHen, bienSo, noiDung, cvdvTen] = cols;
        if (!/^\d{1,2}:\d{2}$/.test(gioHen)) return; // bỏ dòng tiêu đề / không hợp lệ
        const staff = staffList.find((s) => s.ho_ten.trim().toLowerCase() === cvdvTen.trim().toLowerCase());
        const targetIdx = startIdx + li;
        while (next.length <= targetIdx) next.push(emptyGridRow());
        next[targetIdx] = {
          gioHen,
          bienSo: bienSo.toUpperCase(),
          noiDung,
          cvdvId: staff ? staff.id : "",
        };
      });
      return next;
    });
  }

  async function submitGrid() {
    const valid = gridRows.filter((r) => r.bienSo.trim() && r.gioHen);
    if (valid.length === 0) return showToast("❌ Chưa có dòng nào hợp lệ (cần ít nhất Giờ hẹn + Biển số).");
    const payload = valid.map((r) => ({
      bien_so: r.bienSo.toUpperCase().trim(),
      loai: "hen",
      gio_hen: combineDateTime(gridDate, r.gioHen),
      noi_dung: r.noiDung || null,
      cvdv_id: r.cvdvId || null,
    }));
    const { error } = await supabase.from("service_records").insert(payload);
    if (error) return showToast("❌ " + error.message);
    showToast(`✅ Đã lưu ${payload.length} lịch hẹn`);
    setGridRows(makeGridRows(6));
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
          <h3 style={{ marginTop: 0 }}>📋 Nhập nhiều lịch hẹn (dạng bảng)</h3>

          <div className="fieldLabel" style={{ marginTop: 0 }}>Ngày hẹn áp dụng cho tất cả các dòng bên dưới</div>
          <input className="textInput" type="date" value={gridDate} onChange={(e) => setGridDate(e.target.value)} style={{ maxWidth: 220 }} />

          <div className="fieldLabel">
            Gõ trực tiếp từng ô, hoặc copy 4 cột <b>Giờ Hẹn, Biển số, Nội dung, CVDV</b> từ Google Sheet rồi dán
            (Ctrl+V) vào ô <b>Giờ</b> của 1 dòng bất kỳ — app tự điền các dòng tiếp theo, kể cả tự chọn đúng CVDV
            nếu tên khớp danh sách.
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="gridTable">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Giờ</th>
                  <th>Biển số</th>
                  <th>Nội dung</th>
                  <th style={{ width: 160 }}>CVDV</th>
                  <th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {gridRows.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        className="gridInput"
                        type="time"
                        value={row.gioHen}
                        onChange={(e) => updateCell(i, "gioHen", e.target.value)}
                        onPaste={(e) => handleGridPaste(e, i)}
                      />
                    </td>
                    <td>
                      <input
                        className="gridInput"
                        placeholder="51K12345"
                        value={row.bienSo}
                        onChange={(e) => updateCell(i, "bienSo", e.target.value)}
                        onPaste={(e) => handleGridPaste(e, i)}
                      />
                    </td>
                    <td>
                      <input
                        className="gridInput"
                        placeholder="Nội dung"
                        value={row.noiDung}
                        onChange={(e) => updateCell(i, "noiDung", e.target.value)}
                      />
                    </td>
                    <td>
                      <select className="gridInput" value={row.cvdvId} onChange={(e) => updateCell(i, "cvdvId", e.target.value)}>
                        <option value="">—</option>
                        {staffList.map((s) => (
                          <option key={s.id} value={s.id}>{s.ho_ten}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button className="gridRemoveBtn" onClick={() => removeGridRow(i)} aria-label="Xoá dòng">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button className="action secondary" onClick={addGridRow} style={{ flex: 1 }}>+ Thêm dòng</button>
            <button className="action" onClick={submitGrid} style={{ flex: 2 }}>✅ LƯU CÁC DÒNG HỢP LỆ</button>
          </div>
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
