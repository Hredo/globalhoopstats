"use client"

/**
 * Realism kit for the hero duel scene — no external assets (works under the
 * app's self-only CSP). <Studio> provides a procedural studio environment via
 * Lightformers (→ real PBR reflections) plus an optional contact shadow and a
 * key/fill/rim light rig.
 */

import { Environment, Lightformer, ContactShadows } from "@react-three/drei"
import * as THREE from "three"

export function Studio({
  shadowY = -1.55,
  shadow = true,
}: {
  shadowY?: number
  shadow?: boolean
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 6, 4]} intensity={2.4} color="#fff2e0" />
      <directionalLight position={[-5, 2, -3]} intensity={0.9} color="#7f93e6" />
      <pointLight position={[0, 1, -5]} intensity={30} color="#f0892f" />

      <Environment resolution={256}>
        <group>
          <Lightformer form="rect" intensity={3} position={[0, 4, 3]} scale={[8, 4, 1]} color="#ffffff" />
          <Lightformer form="rect" intensity={1.6} position={[-4, 1, 2]} scale={[3, 5, 1]} color="#ffd9b0" />
          <Lightformer form="ring" intensity={2} position={[4, 2, -3]} scale={4} color="#f0892f" />
          <Lightformer form="circle" intensity={1.2} position={[0, -3, 2]} scale={5} color="#4a5bd0" />
        </group>
      </Environment>

      {shadow ? (
        <ContactShadows
          position={[0, shadowY, 0]}
          opacity={0.55}
          scale={12}
          blur={2.6}
          far={5}
          resolution={512}
          color="#0a0704"
        />
      ) : null}
    </>
  )
}

function makeCanvas(w: number, h: number) {
  const cv = document.createElement("canvas")
  cv.width = w
  cv.height = h
  return { cv, g: cv.getContext("2d")! }
}
function texture(cv: HTMLCanvasElement, srgb = false) {
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 8
  return t
}

/**
 * Realistic classic basketball (matches a reference photo): warm leather with
 * fine pebble grain, and the standard 8-panel seam layout carved as dark
 * grooves — each seam gets a soft shadow gutter so it reads as a depression,
 * not just a painted line.
 */
export function makeBasketballTextures() {
  const W = 1024
  const H = 512
  const color = makeCanvas(W, H)
  const bump = makeCanvas(W, H)

  // base leather — warm mid-orange, slightly darker toward the poles
  const grad = color.g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, "#b85e1f")
  grad.addColorStop(0.5, "#d0722a")
  grad.addColorStop(1, "#a9531b")
  color.g.fillStyle = grad
  color.g.fillRect(0, 0, W, H)
  // broad tonal variation
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const r = 40 + Math.random() * 120
    const rg = color.g.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, Math.random() > 0.5 ? "rgba(70,30,8,0.08)" : "rgba(255,190,120,0.09)")
    rg.addColorStop(1, "rgba(0,0,0,0)")
    color.g.fillStyle = rg
    color.g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  // fine pebble speckle baked into the colour for grain realism
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    color.g.fillStyle = Math.random() > 0.5 ? "rgba(60,25,6,0.10)" : "rgba(255,205,150,0.10)"
    color.g.beginPath()
    color.g.arc(x, y, 0.6 + Math.random() * 1.1, 0, Math.PI * 2)
    color.g.fill()
  }

  // bump: mid-grey base + dense raised pebbles
  bump.g.fillStyle = "#7d7d7d"
  bump.g.fillRect(0, 0, W, H)
  for (let i = 0; i < 34000; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const v = 150 + Math.random() * 105
    bump.g.fillStyle = `rgb(${v},${v},${v})`
    bump.g.beginPath()
    bump.g.arc(x, y, 0.7 + Math.random() * 1.4, 0, Math.PI * 2)
    bump.g.fill()
  }

  // seam paths: equator, two meridians (→ full vertical great circle) + two
  // bowed side seams, matching a real ball's eight panels.
  const strokeSeams = (g: CanvasRenderingContext2D, w: number, color: string) => {
    g.lineCap = "round"
    g.strokeStyle = color
    g.lineWidth = w
    g.beginPath()
    g.moveTo(0, H / 2)
    g.lineTo(W, H / 2)
    g.stroke()
    for (const x of [0, W * 0.5, W]) {
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x, H)
      g.stroke()
    }
    for (const cx of [W * 0.25, W * 0.75]) {
      g.beginPath()
      for (let y = 0; y <= H; y += 6) {
        const x = cx + Math.sin((y / H) * Math.PI) * 46 * (cx < W / 2 ? -1 : 1)
        if (y === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.stroke()
    }
  }
  // colour map: soft dark gutter under a crisp black seam
  strokeSeams(color.g, 22, "rgba(30,14,4,0.5)")
  strokeSeams(color.g, 11, "#120a04")
  // bump: carve the grooves deep (near-black = recessed)
  strokeSeams(bump.g, 20, "#0a0a0a")

  return { map: texture(color.cv, true), bump: texture(bump.cv) }
}
