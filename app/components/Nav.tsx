"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_ITEMS = [
  { href: "/bao-ve", label: "Bảo vệ", icon: "🚗" },
  { href: "/cvdv", label: "CVDV — Lịch hẹn", icon: "📅" },
  { href: "/bao-cao", label: "Báo cáo", icon: "📊" },
  { href: "/quan-tri", label: "Quản trị", icon: "🛠️" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      <div className="brandBlock">
        <div className="brandLogoBox">
          <img src="/volvo-logo.jpg" alt="Volvo" className="brandLogoImg" />
        </div>
        <div className="brandSub">Kiểm Soát Xe Ra Vào</div>
      </div>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={"navItem" + (pathname === item.href ? " active" : "")}
          onClick={onNavigate}
        >
          <span>{item.icon}</span> {item.label}
        </Link>
      ))}
    </>
  );
}

export function SidebarNav() {
  return (
    <nav className="sidebar">
      <NavLinks />
    </nav>
  );
}

export function NavToggle({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="navToggle" onClick={onOpen} aria-label="Mở menu">
      ☰
    </button>
  );
}

export function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="navDrawerOverlay" onClick={onClose}>
      <div className="navDrawer" onClick={(e) => e.stopPropagation()}>
        <NavLinks onNavigate={onClose} />
      </div>
    </div>
  );
}
