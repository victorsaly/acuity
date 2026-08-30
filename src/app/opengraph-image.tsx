import { ImageResponse } from "next/og";

export const alt = "Delulu Beats — nine perception games for eyes, ears, and timing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

const accents = ["#ff5959", "#ffb454", "#ffe95c", "#a4ff4f", "#3dc9ff", "#6d8cff", "#e05fd0"];

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0c0d12",
        color: "#eff0f4",
        padding: "72px 84px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: 790 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 76,
              height: 76,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "6px solid #eff0f4",
              borderRadius: "50%",
            }}
          >
            <div style={{ width: 20, height: 20, background: "#eff0f4", borderRadius: "50%" }} />
          </div>
          <div style={{ fontSize: 76, fontWeight: 900, textTransform: "uppercase" }}>Delulu Beats</div>
        </div>
        <div style={{ display: "flex", marginTop: 54, fontSize: 36, lineHeight: 1.35, color: "#b9bdc8" }}>
          Nine free perception games for eyes, ears, memory, and timing.
        </div>
        <div style={{ display: "flex", marginTop: 42, fontSize: 23, textTransform: "uppercase", color: "#7e8290" }}>
          Play in your browser · headphones recommended
        </div>
      </div>
      <div style={{ width: 190, height: 420, display: "flex", alignItems: "flex-end", gap: 12 }}>
        {accents.map((color, index) => (
          <div
            key={color}
            style={{
              width: 18,
              height: 100 + ((index * 71) % 280),
              background: color,
              borderRadius: 9,
            }}
          />
        ))}
      </div>
    </div>,
    size,
  );
}