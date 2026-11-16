import { AuthProvider } from "./Providers";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "MoneyMate Thailand",
  description: "MoneyMate Thailand exchange app.",
  icons: {
    icon: "/moneymate-mark.png",
    shortcut: "/moneymate-mark.png",
    apple: "/moneymate-mark.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
