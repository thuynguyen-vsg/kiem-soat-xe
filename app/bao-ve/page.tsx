"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { SidebarNav, NavToggle, NavDrawer } from "@/app/components/Nav";

type Record = {
  id: string;
  bien_so: string;
  loai: string;
  gio_hen: string | null;
  noi_dung: string | null;
  cvdv_id: string | null;
  cvdv?: { ho_ten: string } | null;
  gio_vao: string | null;
  km: number | null;
  so_phieu: string | null;
  gio_ra: string | null;
  dai_ly: string | null;
  created_at: string;
};

const CARRYOVER_DAYS = 14;

function fmtTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
function toHHMM(d: Date) {
  return d.toTimeString().slice(0, 5);
}
function refDate(r: Record) {
  return new Date(r.gio_hen || r.gio_vao || r.created_at);
}

export default function BaoVePage() {
  const [rows, setRows] = useState<Record[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [entryGio, setEntryGio] = useState("");
  const [entryKm, setEntryKm] = useState("");
  const [phieuVal, setPhieuVal] = useState("");
  const [gioRaVal, setGioRaVal] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addBienSo, setAddBienSo] = useState("");
  const [addNoiDung, setAddNoiDung] = useState("");
  const [addLoai, setAddLoai] = useState("vang_lai");
  const [addGioVao, setAddGioVao] = useState("");
  const [addCvdvId, setAddCvdvId] = useState("");
  const [addDaiLy, setAddDaiLy] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [staffList, setStaffList] = useState<{ id: string; ho_ten: string }[]>([]);
  const [navOpen, setNavOpen] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    const start = new Date();
    start.setDate(start.getDate() - CARRYOVER_DAYS);
    start.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("service_records")
      .select("*, cvdv:staff!cvdv_id(ho_ten)")
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      showToast("❌ Lỗi tải dữ liệu: " + error.message);
      return;
    }
    setRows((data as unknown as Record[]) || []);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 30000);
    return () => clearInterval(t);
  }, [loadData]);

  useEffect(() => {
    supabase
      .from("staff")
      .select("id, ho_ten")
      .eq("vai_tro", "cvdv")
      .eq("active", true)
      .order("ho_ten")
      .then(({ data }) => setStaffList(data || []));
  }, []);

  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  const isToday = (r: Record) => {
    const d = refDate(r);
    return d >= today0 && d < new Date(today0.getTime() + 86400000);
  };

  const displayRows = rows
    .filter((r) => isToday(r) || !r.gio_ra)
    .filter((r) => r.bien_so.toUpperCase().includes(search.toUpperCase()))
    .sort((a, b) => {
      const da = isToday(a) ? today0.getTime() : refDate(a).getTime();
      const db = isToday(b) ? today0.getTime() : refDate(b).getTime();
      if (da !== db) return db - da; // mới nhất trước
      const aDone = !!a.gio_ra, bDone = !!b.gio_ra;
      if (aDone !== bDone) return aDone ? 1 : -1;
      return 0;
    });

  function classify(r: Record): "ok" | "block" | "done" {
    if (r.gio_ra) return "done";
    return r.so_phieu ? "ok" : "block";
  }

  function openDetail(r: Record) {
    setSelected(r);
    setPhieuVal("");
    const now = new Date();
    setEntryGio(toHHMM(now));
    setEntryKm("");
    setGioRaVal(toHHMM(now));
  }

  async function confirmEntry() {
    if (!selected) return;
    const now = new Date();
    const [hh, mm] = entryGio.split(":").map(Number);
    const gioVao = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm).toISOString();
    const { error } = await supabase
      .from("service_records")
      .update({ gio_vao: gioVao, km: entryKm ? Number(entryKm) : null })
      .eq("id", selected.id);
    if (error) return showToast("❌ " + error.message);
    showToast("✅ Đã ghi nhận xe vào lúc " + entryGio);
    setSelected(null);
    loadData();
  }

  async function confirmPhieu() {
    if (!selected) return;
    const value = phieuVal.trim() || "Bảo vệ xác nhận " + toHHMM(new Date());
    const { error } = await supabase
      .from("service_records")
      .update({ so_phieu: value, ngay_gio_phieu: new Date().toISOString() })
      .eq("id", selected.id);
    if (error) return showToast("❌ " + error.message);
    showToast("✅ Đã ghi nhận phiếu");
    setSelected(null);
    loadData();
  }

  async function confirmExit() {
    if (!selected) return;
    if (!selected.so_phieu) return showToast("❌ Chưa có phiếu ra cổng.");
    const now = new Date();
    const [hh, mm] = gioRaVal.split(":").map(Number);
    const gioRa = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm).toISOString();
    const { error } = await supabase
      .from("service_records")
      .update({ gio_ra: gioRa })
      .eq("id", selected.id);
    if (error) return showToast("❌ " + error.message);
    showToast("✅ Đã ghi nhận xe ra lúc " + gioRaVal);
    setSelected(null);
    loadData();
  }

  async function submitAddCar() {
    if (!addBienSo.trim()) return showToast("❌ Vui lòng nhập biển số.");
    const now = new Date();
    let gioVao = now;
    if (addGioVao) {
      const [hh, mm] = addGioVao.split(":").map(Number);
      gioVao = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
    }
    const { error } = await supabase.from("service_records").insert({
      bien_so: addBienSo.toUpperCase().trim(),
      loai: addLoai,
      noi_dung: addNoiDung || null,
      cvdv_id: addCvdvId || null,
      dai_ly: addDaiLy || null,
      gio_vao: gioVao.toISOString(),
    });
    if (error) return showToast("❌ " + error.message);
    showToast("✅ Đã thêm xe " + addBienSo.toUpperCase());
    setAddOpen(false);
    setAddBienSo("");
    setAddNoiDung("");
    setAddCvdvId("");
    setAddDaiLy("");
    loadData();
  }

  return (
    <div className="appShell">
      <SidebarNav />
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="mainArea">
      <div className="header">
        <div className="headerTop">
          <NavToggle onOpen={() => setNavOpen(true)} />
          <h1>🚗 Kiểm Soát Xe Ra Cổng</h1>
        </div>
        <input
          className="searchBox"
          placeholder="Gõ biển số để tìm nhanh..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="meta">
          {displayRows.length} xe • cập nhật {lastUpdated ? lastUpdated.toLocaleTimeString("vi-VN") : "—"}
        </div>
      </div>

      <div className="list">
        {displayRows.map((r) => {
          const cls = classify(r);
          return (
            <div key={r.id} className={"card " + cls} onClick={() => openDetail(r)}>
              <div>
                <div className="bienso">
                  {r.bien_so}
                  {r.dai_ly && <span className="dailyTag">{r.dai_ly}</span>}
                </div>
                <div className="noidung">{r.noi_dung || ""}</div>
                {r.cvdv?.ho_ten && <div className="cvdv">CVDV: {r.cvdv.ho_ten}</div>}
                <div className="giohen">
                  Hẹn: {fmtTime(r.gio_hen) || "—"}
                  {r.gio_vao && " • Vào: " + fmtTime(r.gio_vao)}
                  {r.gio_ra && " • Ra: " + fmtTime(r.gio_ra)}
                </div>
              </div>
              <div className={"badge " + cls}>
                {cls === "done" ? "✅ ĐÃ RA" : cls === "ok" ? "🟢 ĐỦ ĐK" : "🔴 CHƯA ĐỦ ĐK"}
              </div>
            </div>
          );
        })}
      </div>

      <button className="fabAdd" onClick={() => setAddOpen(true)}>＋</button>

      {selected && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="sheet">
            <div className="bigplate">{selected.bien_so}</div>
            <div className="subinfo">{selected.noi_dung} • Hẹn {fmtTime(selected.gio_hen) || "—"}</div>

            {!selected.gio_vao ? (
              <>
                <div className="fieldLabel">Giờ xe vào xưởng</div>
                <input className="textInput" type="time" value={entryGio} onChange={(e) => setEntryGio(e.target.value)} />
                <div className="fieldLabel">Số km</div>
                <input className="textInput" type="number" placeholder="VD: 45231" value={entryKm} onChange={(e) => setEntryKm(e.target.value)} />
                <button className="action secondary" onClick={confirmEntry}>🚗 XÁC NHẬN XE VÀO XƯỞNG</button>
              </>
            ) : (
              <div className="subinfo">🚗 Đã vào lúc {fmtTime(selected.gio_vao)} {selected.km ? "• Km: " + selected.km : ""}</div>
            )}

            {selected.gio_ra ? (
              <div className="statusBox done">✅ Xe đã ra cổng lúc {fmtTime(selected.gio_ra)}</div>
            ) : selected.so_phieu ? (
              <>
                <div className="statusBox ok">🟢 Đủ điều kiện ra cổng (phiếu: {selected.so_phieu})</div>
                <div className="fieldLabel">Giờ xe ra</div>
                <input className="textInput" type="time" value={gioRaVal} onChange={(e) => setGioRaVal(e.target.value)} />
                <button className="action" onClick={confirmExit}>✅ XÁC NHẬN XE RA CỔNG</button>
              </>
            ) : (
              <>
                <div className="statusBox block">🔴 CHƯA CÓ PHIẾU RA CỔNG — KHÔNG ĐƯỢC CHO XE RA</div>
                <div className="fieldLabel">Số phiếu ra cổng (để trống cũng được)</div>
                <input className="textInput" placeholder="VD: 000123" value={phieuVal} onChange={(e) => setPhieuVal(e.target.value)} />
                <button className="action secondary" onClick={confirmPhieu}>📋 XÁC NHẬN ĐÃ NHẬN PHIẾU RA CỔNG</button>
              </>
            )}

            <button className="close" onClick={() => setSelected(null)}>Đóng</button>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setAddOpen(false)}>
          <div className="sheet">
            <h3>🚙 Thêm Xe Vãng Lai</h3>
            <div className="fieldLabel">Biển số (bắt buộc)</div>
            <input className="textInput" placeholder="VD: 51K12345" value={addBienSo} onChange={(e) => setAddBienSo(e.target.value)} />
            <div className="fieldLabel">Loại xe</div>
            <select className="textInput" value={addLoai} onChange={(e) => setAddLoai(e.target.value)}>
              <option value="vang_lai">Vãng lai (không hẹn trước)</option>
              <option value="giam_dinh">Giám định bảo hiểm</option>
            </select>
            <div className="fieldLabel">Giờ vào xưởng</div>
            <input className="textInput" type="time" value={addGioVao} onChange={(e) => setAddGioVao(e.target.value)} />
            <div className="fieldLabel">Nội dung / Lý do</div>
            <input className="textInput" placeholder="VD: Kiểm tra đèn báo lỗi" value={addNoiDung} onChange={(e) => setAddNoiDung(e.target.value)} />
            <div className="fieldLabel">CVDV phụ trách (nếu có)</div>
            <select className="textInput" value={addCvdvId} onChange={(e) => setAddCvdvId(e.target.value)}>
              <option value="">— Chưa rõ / chưa phân công —</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.ho_ten}</option>
              ))}
            </select>
            <div className="fieldLabel">Đại lý</div>
            <select className="textInput" value={addDaiLy} onChange={(e) => setAddDaiLy(e.target.value)}>
              <option value="">— Chưa chọn —</option>
              <option value="VSG">VSG</option>
              <option value="VDS">VDS</option>
            </select>
            <button className="action" onClick={submitAddCar}>➕ THÊM VÀO DANH SÁCH</button>
            <button className="close" onClick={() => setAddOpen(false)}>Hủy</button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}
