import "./globals.css";

export const metadata = {
  title: "Kiểm Soát Xe Ra Vào",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Xe Ra Vào",
  },
  other: {
    // iOS bản cũ chỉ nhận thẻ này (không nhận "mobile-web-app-capable" chuẩn mới)
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0b3d91",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
