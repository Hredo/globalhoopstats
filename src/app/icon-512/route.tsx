import { ImageResponse } from "next/og"
import { BallMark } from "@/lib/brand-mark"

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        borderRadius: 96,
      }}
    >
      <BallMark size={380} />
    </div>,
    { width: 512, height: 512 },
  )
}
