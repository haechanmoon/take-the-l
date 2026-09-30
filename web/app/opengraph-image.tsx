import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#171420", color: "#fff6dc" }}>
      <div style={{ fontSize: 34, letterSpacing: 8, color: "#fdca6a" }}>L을 가져가 · 엘을 가져가</div>
      <div style={{ fontSize: 140, fontWeight: 900, lineHeight: 1.15 }}>TAKE THE L</div>
      <div style={{ fontSize: 40 }}>들어와서, 그냥 춤춰.</div>
    </div>,
    size,
  );
}
