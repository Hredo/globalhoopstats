import { ImageResponse } from "next/og"
import { SITE } from "@/lib/site"
import { BallMark } from "@/lib/brand-mark"

export const alt = "globalhoopstats — Cross-league basketball intelligence"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const runtime = "nodejs"

export default async function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#0a0a0a",
        padding: "72px 72px 56px",
        color: "#ffffff",
        fontFamily: "system-ui",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 200,
          right: -80,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(255,115,0,0.10) 0%, rgba(187,57,0,0.03) 70%, transparent 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 72,
          right: 72,
          height: 4,
          background: "linear-gradient(90deg, #ff7300 0%, #bb3900 100%)",
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 18,
          marginTop: 4,
        }}
      >
        <BallMark size={56} />
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>
          {SITE.name}
        </div>
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          paddingTop: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 78,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: -3,
            color: "#ffffff",
          }}
        >
          <span>Cross-league basketball</span>
          <span
            style={{
              background: "linear-gradient(135deg, #ff7300, #ffa75f)",
              color: "transparent",
              marginTop: 4,
            }}
          >
            intelligence
          </span>
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 26,
            color: "#a3a3a3",
            maxWidth: 720,
            lineHeight: 1.3,
          }}
        >
          Box scores, advanced splits, player comparison, market valuations, trade simulator and AI scouting — all in one console.
        </div>
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          gap: 10,
          fontSize: 19,
          color: "#e5e5e5",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 999,
            border: "1px solid rgba(255,115,0,0.25)",
            background: "rgba(255,115,0,0.08)",
          }}
        >
          NBA · EuroLeague · ACB · FEB
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          Player comparisons
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          Trade simulator
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          AI scouting advisor
        </div>
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 22,
          fontSize: 17,
          color: "#666666",
        }}
      >
        <span>{SITE.url.replace("https://", "")}</span>
        <span style={{ color: "#ff7300" }}>Hoops, decoded.</span>
      </div>
    </div>,
    { ...size },
  )
}
