"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type HenRecord = {
  id: string;
  bien_so: string;
  gio_hen: string;
  noi_dung: string | null;
  cvdv_id: string | null;
  cvdv?: { ho_ten: string } | null;
  gio_vao: string | null;
};

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

  return (
    <div>
      <div className="header">
        <h1>📅 CVDV — Đặt Lịch Hẹn</h1>
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

      <div className="roleSwitch">
        <Link href="/bao-ve">🚗 Sang trang Bảo vệ — Kiểm soát xe ra/vào</Link>
      </div>
    </div>
  );
}
