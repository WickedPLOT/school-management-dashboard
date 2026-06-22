import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HAYRAT Centers",
  description: "Hayrat Centers Management Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{
          __html: `window.addEventListener('error',function(e){console.error('GLOBAL_ERROR:',e.message,e.filename,e.lineno)});window.addEventListener('unhandledrejection',function(e){console.error('UNHANDLED_REJECTION:',e.reason)});`
        }} />
        {children}
      </body>
    </html>
  );
}
