import "./globals.css";

export const metadata = {
  title: "WINPAY Admin",
  description: "WINPAY partner admin dashboard"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
