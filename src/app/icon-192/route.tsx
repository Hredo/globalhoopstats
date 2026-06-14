import { ImageResponse } from "next/og"
import { BallMark } from "@/lib/brand-mark"

export const contentType = "image/png"

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
        borderRadius: 36,
      }}
    >
      <BallMark size={140} />
    </div>,
    { width: 192, height: 192 },
  )
}
