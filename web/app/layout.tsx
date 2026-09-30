import type { Metadata } from "next";
import "./styles.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "L을 가져가 · 엘을 가져가 | Take the L",
  description: "닉네임만 쓰고 입장! 다섯 공개방에서 친구들과 만나 춤추는 무료 웹 놀이터. 휴대폰과 PC에서 바로 플레이해.",
  keywords: ["L을 가져가", "엘을 가져가", "Take the L", "춤 게임", "웹 놀이터"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "L을 가져가 — Take the L",
    description: "친구들과 모여서 춤추는 공개 놀이터",
    url: "/",
    siteName: "Take the L",
    locale: "ko_KR",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
