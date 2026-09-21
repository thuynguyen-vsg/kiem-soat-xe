"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { SidebarNav, NavToggle, NavDrawer } from "@/app/components/Nav";

type Rec = {
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

type Staff = { id: string; ho_ten: string; vai_tro: string; active: boolean };

type AuditRow = {
  id: string;
  record_id: string | null;
  hanh_dong: string;
  thoi_gian: string;
  gia_tri_cu: Record<string, unknown> | null;
  gia_tri_moi: Record<string, unknown> | null;
};

const LOAI_LABEL: Record<string, string> = { hen: "Hẹn", vang_lai: "Vãng lai", giam_dinh: "Giám định BH" };

function isoToLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(v: string) {
  return v ? new Date(v).toISOString() : null;
}
function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const DATE_FIELDS = new Set(["gio_hen", "gio_vao", "gio_ra", "ngay_gio_phieu"]);

function valuesDiffer(key: string, oldV: unknown, newV: unknown) {
  const a = oldV ?? null;
  const b = newV ?? null;
  if (a === null && b === null) return false;
  if (DATE_FIELDS.has(key)) {
    const ta = a ? new Date(a as string).getTime() : null;
    const tb = b ? new Date(b as string).getTime() : null;
    return ta !== tb;
  }
  return a !== b;
}

function summarizeAudit(a: AuditRow) {
  const bienSo = (a.gia_tri_cu?.bien_so as string) || (a.gia_tri_moi?.bien_so as string) || "?";
  if (a.hanh_dong === "xoa") return `🗑️ Xoá xe ${bienSo}`;
  if (a.hanh_dong === "sua") {
    const fields: [string, string][] = [
      ["bien_so", "Biển số"], ["gio_hen", "Giờ hẹn"], ["noi_dung", "Nội dung"],
      ["cvdv_id", "CVDV"], ["gio_vao", "Giờ vào"], ["km", "Km"],
      ["so_phieu", "Số phiếu"], ["gio_ra", "Giờ ra"], ["dai_ly", "Đại lý"],
    ];
    const changed: string[] = [];
    for (const [key, label] of fields) {
      if (valuesDiffer(key, a.gia_tri_cu?.[key], a.gia_tri_moi?.[key])) changed.push(label);
    }
    return `✏️ Sửa xe ${bienSo}` + (changed.length ? ` — đổi: ${changed.join(", ")}` : "");
  }
  return `${a.hanh_dong} — ${bienSo}`;
}

export default function QuanTriPage() {
  const [navOpen, setNavOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // ---------- Nhân sự ----------
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [newStaffName, setNewStaffName] = useState("");

  const loadStaff = useCallback(async () => {
    const { data } = await supabase.from("staff").select("id, ho_ten, vai_tro, active").order("ho_ten");
    setStaffList(data || []);
  }, []);

  async function addStaff() {
    if (!newStaffName.trim()) return;
    const { error } = await supabase.from("staff").insert({ ho_ten: newStaffName.trim(), vai_tro: "cvdv", active: true });
    if (error) return showToast("❌ " + error.message);
    setNewStaffName("");
    showToast("✅ Đã thêm CVDV");
    loadStaff();
  }
  async function toggleStaffActive(s: Staff) {
    const { error } = await supabase.from("staff").update({ active: !s.active }).eq("id", s.id);
    if (error) return showToast("❌ " + error.message);
    loadStaff();
  }

  // ---------- Danh sách xe ----------
  const [rows, setRows] = useState<Rec[]>([]);
  const [search, setSearch] = useState("");

  const loadRows = useCallback(async () => {
    const { data, error } = await supabase
      .from("service_records")
      .select("*, cvdv:staff!cvdv_id(ho_ten)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) return showToast("❌ Lỗi tải danh sách: " + friendlyError(error.message));
    setRows((data as unknown as Rec[]) || []);
  }, []);

  const displayRows = rows.filter((r) => r.bien_so.toUpperCase().includes(search.toUpperCase()));

  // ---------- Sửa ----------
  const [editing, setEditing] = useState<Rec | null>(null);
  const [eBienSo, setEBienSo] = useState("");
  const [eLoai, setELoai] = useState("vang_lai");
  const [eGioHen, setEGioHen] = useState("");
  const [eNoiDung, setENoiDung] = useState("");
  const [eCvdvId, setECvdvId] = useState("");
  const [eGioVao, setEGioVao] = useState("");
  const [eKm, setEKm] = useState("");
  const [eSoPhieu, setESoPhieu] = useState("");
  const [eGioRa, setEGioRa] = useState("");
  const [eDaiLy, setEDaiLy] = useState("");

  function openEdit(r: Rec) {
    setEditing(r);
    setEBienSo(r.bien_so);
    setELoai(r.loai);
    setEGioHen(isoToLocalInput(r.gio_hen));
    setENoiDung(r.noi_dung || "");
    setECvdvId(r.cvdv_id || "");
    setEGioVao(isoToLocalInput(r.gio_vao));
    setEKm(r.km != null ? String(r.km) : "");
    setESoPhieu(r.so_phieu || "");
    setEGioRa(isoToLocalInput(r.gio_ra));
    setEDaiLy(r.dai_ly || "");
  }

  async function saveEdit() {
    if (!editing) return;
    if (!eBienSo.trim()) return showToast("❌ Biển số không được để trống.");
    const newValues = {
      bien_so: eBienSo.toUpperCase().trim(),
      loai: eLoai,
      gio_hen: localInputToIso(eGioHen),
      noi_dung: eNoiDung || null,
      cvdv_id: eCvdvId || null,
      gio_vao: localInputToIso(eGioVao),
      km: eKm ? Number(eKm) : null,
      so_phieu: eSoPhieu || null,
      gio_ra: localInputToIso(eGioRa),
      dai_ly: eDaiLy || null,
    };
    const { error } = await supabase.from("service_records").update(newValues).eq("id", editing.id);
    if (error) return showToast("❌ " + error.message);
    await supabase.from("audit_log").insert({
      record_id: editing.id,
      hanh_dong: "sua",
      gia_tri_cu: editing,
      gia_tri_moi: newValues,
    });
    showToast("✅ Đã lưu thay đổi — lịch sử đã được ghi lại");
    setEditing(null);
    loadRows();
    loadAudit();
  }

  const [confirmDeleteRec, setConfirmDeleteRec] = useState<Rec | null>(null);

  async function confirmDeleteNow() {
    const r = confirmDeleteRec;
    if (!r) return;
    setConfirmDeleteRec(null);
    await supabase.from("audit_log").insert({
      record_id: r.id,
      hanh_dong: "xoa",
      gia_tri_cu: r,
      gia_tri_moi: null,
    });
    const { error } = await supabase.from("service_records").delete().eq("id", r.id);
    if (error) return showToast("❌ " + error.message);
    showToast("✅ Đã xoá " + r.bien_so + " — lịch sử đã được ghi lại");
    loadRows();
    loadAudit();
  }

  // ---------- Lịch sử thao tác ----------
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const loadAudit = useCallback(async () => {
    const { data } = await supabase
      .from("audit_log")
      .select("id, record_id, hanh_dong, thoi_gian, gia_tri_cu, gia_tri_moi")
      .order("thoi_gian", { ascending: false })
      .limit(50);
    setAudit((data as unknown as AuditRow[]) || []);
  }, []);

  useEffect(() => {
    loadStaff();
    loadRows();
    loadAudit();
  }, [loadStaff, loadRows, loadAudit]);

  return (
    <div className="appShell">
      <SidebarNav />
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="mainArea">
        <div className="header">
          <div className="headerTop">
            <NavToggle onOpen={() => setNavOpen(true)} />
            <h1>🛠️ Quản Trị</h1>
          </div>
          <div className="meta">Sửa/xoá dữ liệu do nhập sai — mọi thao tác đều được ghi lịch sử</div>
        </div>

        <div className="list">
          {/* ---------- Quản lý CVDV ---------- */}
          <div className="card" style={{ display: "block", cursor: "default" }}>
            <h3 style={{ marginTop: 0 }}>👥 Quản lý CVDV</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                className="textInput"
                style={{ marginBottom: 0 }}
                placeholder="Tên CVDV mới"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
              />
              <button className="action" style={{ width: 120, marginBottom: 0 }} onClick={addStaff}>+ Thêm</button>
            </div>
            {staffList.map((s) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #eee" }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 700, opacity: s.active ? 1 : 0.5 }}>{s.ho_ten}</div>
                  <div style={{ fontSize: 12, color: "#999" }}>{s.vai_tro}{!s.active && " • đã ngừng hoạt động"}</div>
                </div>
                <button
                  className="close"
                  style={{ width: "auto", padding: "8px 14px" }}
                  onClick={() => toggleStaffActive(s)}
                >
                  {s.active ? "Ngừng hoạt động" : "Kích hoạt lại"}
                </button>
              </div>
            ))}
          </div>

          {/* ---------- Danh sách xe ---------- */}
          <div className="card" style={{ display: "block", cursor: "default" }}>
            <h3 style={{ marginTop: 0 }}>🚗 Danh sách xe ({displayRows.length})</h3>
            <input
              className="textInput"
              placeholder="Gõ biển số để tìm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              {displayRows.map((r) => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 4px", borderTop: "1px solid #eee", textAlign: "left" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {r.bien_so} <span style={{ fontWeight: 400, fontSize: 12, color: "#999" }}>({LOAI_LABEL[r.loai] || r.loai}{r.dai_ly ? " • " + r.dai_ly : ""})</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      {r.cvdv?.ho_ten ? "CVDV: " + r.cvdv.ho_ten + " • " : ""}
                      Hẹn {fmt(r.gio_hen)} • Vào {fmt(r.gio_vao)} • Ra {fmt(r.gio_ra)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="close" style={{ width: "auto", padding: "8px 12px" }} onClick={() => openEdit(r)}>Sửa</button>
                    <button
                      className="close"
                      style={{ width: "auto", padding: "8px 12px", background: "#ffebee", color: "#c62828" }}
                      onClick={() => setConfirmDeleteRec(r)}
                    >
                      Xoá
                    </button>
                  </div>
                </div>
              ))}
              {displayRows.length === 0 && <div style={{ color: "#999", padding: 12 }}>Không có bản ghi nào khớp.</div>}
            </div>
          </div>

          {/* ---------- Lịch sử thao tác ---------- */}
          <div className="card" style={{ display: "block", cursor: "default" }}>
            <h3 style={{ marginTop: 0 }}>📜 Lịch sử thao tác gần đây</h3>
            <div style={{ maxHeight: 320, overflowY: "auto", textAlign: "left" }}>
              {audit.length === 0 && <div style={{ color: "#999" }}>Chưa có thao tác sửa/xoá nào.</div>}
              {audit.map((a) => (
                <div key={a.id} style={{ padding: "8px 0", borderTop: "1px solid #eee", fontSize: 13 }}>
                  <div>{summarizeAudit(a)}</div>
                  <div style={{ fontSize: 11, color: "#999" }}>{fmt(a.thoi_gian)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {editing && (
          <div className="overlay" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
            <div className="sheet">
              <h3 style={{ marginTop: 0 }}>✏️ Sửa bản ghi</h3>

              <div className="fieldLabel" style={{ marginTop: 0 }}>Biển số</div>
              <input className="textInput" value={eBienSo} onChange={(e) => setEBienSo(e.target.value)} />

              <div className="fieldLabel">Loại xe</div>
              <select className="textInput" value={eLoai} onChange={(e) => setELoai(e.target.value)}>
                <option value="hen">Hẹn</option>
                <option value="vang_lai">Vãng lai</option>
                <option value="giam_dinh">Giám định bảo hiểm</option>
              </select>

              <div className="fieldLabel">Giờ hẹn</div>
              <input className="textInput" type="datetime-local" value={eGioHen} onChange={(e) => setEGioHen(e.target.value)} />

              <div className="fieldLabel">CVDV phụ trách</div>
              <select className="textInput" value={eCvdvId} onChange={(e) => setECvdvId(e.target.value)}>
                <option value="">— Chưa rõ —</option>
                {staffList.filter((s) => s.vai_tro === "cvdv").map((s) => (
                  <option key={s.id} value={s.id}>{s.ho_ten}</option>
                ))}
              </select>

              <div className="fieldLabel">Đại lý</div>
              <select className="textInput" value={eDaiLy} onChange={(e) => setEDaiLy(e.target.value)}>
                <option value="">— Chưa chọn —</option>
                <option value="VSG">VSG</option>
                <option value="VDS">VDS</option>
              </select>

              <div className="fieldLabel">Nội dung / Lý do</div>
              <input className="textInput" value={eNoiDung} onChange={(e) => setENoiDung(e.target.value)} />

              <div className="fieldLabel">Giờ vào xưởng</div>
              <input className="textInput" type="datetime-local" value={eGioVao} onChange={(e) => setEGioVao(e.target.value)} />

              <div className="fieldLabel">Km</div>
              <input className="textInput" type="number" value={eKm} onChange={(e) => setEKm(e.target.value)} />

              <div className="fieldLabel">Số phiếu ra cổng</div>
              <input className="textInput" value={eSoPhieu} onChange={(e) => setESoPhieu(e.target.value)} />

              <div className="fieldLabel">Giờ ra cổng</div>
              <input className="textInput" type="datetime-local" value={eGioRa} onChange={(e) => setEGioRa(e.target.value)} />

              <button className="action" onClick={saveEdit}>✅ LƯU THAY ĐỔI</button>
              <button className="close" onClick={() => setEditing(null)}>Huỷ</button>
            </div>
          </div>
        )}

        {confirmDeleteRec && (
          <div className="overlay" onClick={(e) => e.target === e.currentTarget && setConfirmDeleteRec(null)}>
            <div className="sheet">
              <h3 style={{ marginTop: 0 }}>🗑️ Xoá bản ghi?</h3>
              <div className="subinfo">
                Biển số <b>{confirmDeleteRec.bien_so}</b> sẽ bị xoá khỏi danh sách.
                <br />Thao tác này sẽ được ghi vào <b>Lịch sử thao tác</b> để tránh mất dấu vết.
              </div>
              <button
                className="action"
                style={{ background: "#c62828" }}
                onClick={confirmDeleteNow}
              >
                🗑️ XOÁ LUÔN
              </button>
              <button className="close" onClick={() => setConfirmDeleteRec(null)}>Huỷ</button>
            </div>
          </div>
        )}

        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}
