"use client"

/**
 * Hero 3D piece — the player-comparison duel.
 * Two faceless mannequin players face off across a holographic radar of
 * advanced stats: one dribbling, one spinning a ball on a finger. Bodies are
 * articulated from capsules with spherical joints so the parts read as one
 * cohesive human. Studio reflections + bloom; draggable; no floor.
 *
 * Imports three/fiber/drei/postprocessing; only ever loaded via a dynamic
 * import with ssr:false (see hero-duel.tsx), so it stays out of the initial
 * bundle and never runs on the server.
 */

import { useCallback, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, type RootState } from "@react-three/fiber"
import { OrbitControls, Line, Html } from "@react-three/drei"
import { EffectComposer, Bloom } from "@react-three/postprocessing"
import * as THREE from "three"
import { Studio, makeBasketballTextures } from "./studio"

// Built once and shared by both figures (the canvas work is expensive, and the
// two balls are identical). This module only ever runs client-side (ssr:false).
let _ballTex: ReturnType<typeof makeBasketballTextures> | null = null
function ballTextures() {
  return (_ballTex ??= makeBasketballTextures())
}

const PLAYER_X = 1.7

const N = 6
const AXES = ["PTS", "REB", "AST", "TS%", "PER", "STL"]
const A = [0.95, 0.45, 0.7, 0.85, 0.82, 0.5]
const B = [0.6, 0.88, 0.92, 0.62, 0.7, 0.72]
const RADAR_R = 1.0

const ORANGE = "#d9812f"
const BLUE = "#5f77d8"

// ── radar ───────────────────────────────────────────────────────────
function radarPositions(vals: number[]): Float32Array {
  const pos = new Float32Array((N + 2) * 3)
  for (let i = 0; i <= N; i++) {
    const idx = i % N
    const ang = (idx / N) * Math.PI * 2 - Math.PI / 2
    const v = vals[idx] * RADAR_R
    pos[(i + 1) * 3] = Math.cos(ang) * v
    pos[(i + 1) * 3 + 1] = Math.sin(ang) * v
  }
  return pos
}
function outline(vals: number[]): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= N; i++) {
    const idx = i % N
    const ang = (idx / N) * Math.PI * 2 - Math.PI / 2
    const v = vals[idx] * RADAR_R
    pts.push(new THREE.Vector3(Math.cos(ang) * v, Math.sin(ang) * v, 0))
  }
  return pts
}

function RadarShape({ vals, color, z }: { vals: number[]; color: string; z: number }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(radarPositions(vals), 3))
    const idx: number[] = []
    for (let i = 1; i <= N; i++) idx.push(0, i, i + 1)
    g.setIndex(idx)
    return g
  }, [vals])
  return (
    <group position={[0, 0, z]}>
      <mesh geometry={geom}>
        <meshBasicMaterial color={color} transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <Line points={outline(vals)} color={color} lineWidth={2.4} transparent opacity={1} toneMapped={false} />
    </group>
  )
}

// ── elegant player silhouette ───────────────────────────────────────
// Each figure is ONE continuous extruded silhouette (no visible joints):
// a smooth beveled "paper-cut" athlete, rotated so the depth reads as 3D.
// The mannequin's right side is a fixed standing profile; the left arm is
// either lowered (holding the ball at the hip) or raised (spinning it up).
const CY = 1.02 // vertical centre of the ~2u-tall silhouette
type Hand = { x: number; y: number; z: number }

const RIGHT_SIDE: [number, number][] = [
  [0.1, 1.62], // neck-right
  [0.31, 1.55], // shoulder
  [0.34, 1.3], // upper arm (outer)
  [0.335, 1.06], // elbow
  [0.305, 0.9], // wrist
  [0.245, 0.85], // hand at hip
  [0.205, 0.95], // inner wrist
  [0.215, 1.14], // inner arm
  [0.17, 1.02], // waist
  [0.225, 0.9], // hip
  [0.205, 0.55], // thigh
  [0.18, 0.42], // knee
  [0.185, 0.2], // calf
  [0.135, 0.03], // ankle
  [0.245, 0.0], // toe
  [0.06, 0.0], // arch
  [0.02, 0.5], // crotch (up inner leg)
]
// same standing profile, but the right arm reaches out/down to cradle the ball
const RIGHT_SIDE_REACH: [number, number][] = [
  [0.1, 1.62], // neck-right
  [0.31, 1.55], // shoulder
  [0.36, 1.3], // upper arm (outer)
  [0.4, 1.08], // elbow
  [0.42, 0.92], // wrist
  [0.44, 0.82], // hand (reaching)
  [0.37, 0.86], // inner wrist
  [0.33, 1.05], // inner arm
  [0.17, 1.02], // waist
  [0.225, 0.9], // hip
  [0.205, 0.55], // thigh
  [0.18, 0.42], // knee
  [0.185, 0.2], // calf
  [0.135, 0.03], // ankle
  [0.245, 0.0], // toe
  [0.06, 0.0], // arch
  [0.02, 0.5], // crotch (up inner leg)
]
const LEFT_LEGS: [number, number][] = [
  [-0.02, 0.5], // crotch-left
  [-0.06, 0.0], // arch
  [-0.245, 0.0], // toe
  [-0.135, 0.03], // ankle
  [-0.185, 0.2], // calf
  [-0.18, 0.42], // knee
  [-0.205, 0.55], // thigh
  [-0.225, 0.9], // hip
]
const LEFT_ARM_DOWN: [number, number][] = [
  [-0.17, 1.02], // waist
  [-0.215, 1.14], // inner arm
  [-0.205, 0.95], // inner wrist
  [-0.245, 0.85], // hand at hip
  [-0.305, 0.9], // wrist
  [-0.335, 1.06], // elbow
  [-0.34, 1.3], // upper arm
  [-0.31, 1.55], // shoulder
  [-0.1, 1.62], // neck-left
]
const LEFT_ARM_UP: [number, number][] = [
  [-0.175, 1.05], // waist
  [-0.155, 1.28], // armpit
  [-0.205, 1.55], // inner upper arm
  [-0.225, 1.86], // inner forearm
  [-0.2, 2.06], // inner wrist
  [-0.12, 2.1], // hand (top)
  [-0.095, 1.95], // outer wrist
  [-0.135, 1.62], // outer arm
  [-0.235, 1.56], // outer shoulder
  [-0.1, 1.62], // neck-left
]

type Variant = "hold" | "raise" | "reach"

function figureShapes(variant: Variant) {
  const pts = [
    ...(variant === "reach" ? RIGHT_SIDE_REACH : RIGHT_SIDE),
    ...LEFT_LEGS,
    ...(variant === "raise" ? LEFT_ARM_UP : LEFT_ARM_DOWN),
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const body = new THREE.Shape(pts)
  const head = new THREE.Shape()
  head.absarc(0, 1.85, 0.19, 0, Math.PI * 2, false)
  return [body, head]
}

const EXTRUDE = {
  depth: 0.17,
  bevelEnabled: true,
  bevelThickness: 0.055,
  bevelSize: 0.05,
  bevelSegments: 5,
  steps: 1,
  curveSegments: 10,
}

function Figure({
  color,
  variant,
  x,
  faceRot,
  phase,
  hand,
}: {
  color: string
  variant: Variant
  x: number
  faceRot: number
  phase: number
  hand: Hand
}) {
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.5,
        metalness: 0.0,
        clearcoat: 0.28,
        clearcoatRoughness: 0.42,
        sheen: 0.35,
        sheenColor: new THREE.Color("#fff4e8"),
        sheenRoughness: 0.6,
        envMapIntensity: 0.85,
      }),
    [color],
  )
  const shapes = useMemo(() => figureShapes(variant), [variant])
  const ball = useMemo(() => ballTextures(), [])
  const root = useRef<THREE.Group>(null)
  const timer = useMemo(() => new THREE.Timer(), [])
  useFrame(() => {
    timer.update()
    if (root.current) root.current.position.y = Math.sin(timer.getElapsed() * 1.1 + phase) * 0.025
  })
  return (
    <group position={[x, 0, 0]} rotation={[0, faceRot, 0]}>
      <group ref={root}>
        <group position={[0, -CY, 0]}>
          {shapes.map((sh, i) => (
            <mesh key={i} material={mat} position={[0, 0, -EXTRUDE.depth / 2]} castShadow>
              <extrudeGeometry args={[sh, EXTRUDE]} />
            </mesh>
          ))}
          <mesh position={[hand.x, hand.y, hand.z]} rotation={[0.28, 0.5, 0.1]} castShadow>
            <sphereGeometry args={[0.18, 64, 64]} />
            <meshPhysicalMaterial
              map={ball.map}
              bumpMap={ball.bump}
              bumpScale={0.05}
              roughness={0.7}
              clearcoat={0.22}
              clearcoatRoughness={0.55}
              envMapIntensity={0.8}
            />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function FigureDuo() {
  return (
    <>
      <Figure color={ORANGE} variant="reach" x={-PLAYER_X} faceRot={0.5} phase={0} hand={{ x: 0.6, y: 0.74, z: 0.16 }} />
      <Figure color={BLUE} variant="raise" x={PLAYER_X} faceRot={-0.5} phase={1.4} hand={{ x: -0.16, y: 2.2, z: 0.12 }} />
    </>
  )
}

function WebGlGuard() {
  const [lost, setLost] = useState(false)
  const onCreated = useCallback((state: RootState) => {
    const canvas = state.gl.domElement
    const onLost = (e: Event) => {
      e.preventDefault()
      setLost(true)
    }
    const onRestored = () => setLost(false)
    canvas.addEventListener("webglcontextlost", onLost)
    canvas.addEventListener("webglcontextrestored", onRestored)
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost)
      canvas.removeEventListener("webglcontextrestored", onRestored)
    }
  }, [])
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0.1, 6.2], fov: 42 }} gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }} onCreated={onCreated} style={lost ? { opacity: 0.3, pointerEvents: "none" } : undefined}>
      <Studio shadow={false} />
      <FigureDuo />
      <Rig />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.32} enableDamping />
      <EffectComposer>
        <Bloom intensity={0.45} luminanceThreshold={0.68} luminanceSmoothing={0.2} mipmapBlur />
      </EffectComposer>
    </Canvas>
  )
}

function Rig() {
  const g = useRef<THREE.Group>(null)
  const timer = useMemo(() => new THREE.Timer(), [])
  useFrame(() => {
    timer.update()
    if (g.current) g.current.rotation.y = Math.sin(timer.getElapsed() * 0.16) * 0.24
  })
  return (
    <group ref={g}>
      {AXES.map((ax, i) => {
        const ang = (i / N) * Math.PI * 2 - Math.PI / 2
        const p = new THREE.Vector3(Math.cos(ang) * (RADAR_R + 0.26), Math.sin(ang) * (RADAR_R + 0.26), 0)
        return (
          <group key={ax}>
            <Line points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(ang) * RADAR_R, Math.sin(ang) * RADAR_R, 0)]} color="#6a5a48" lineWidth={1} transparent opacity={0.4} />
            <group position={p}>
              <Html center distanceFactor={4.6} style={{ pointerEvents: "none" }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono),monospace",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    color: "#fbeee0",
                    background: "rgba(14,10,6,0.5)",
                    padding: "1.5px 5px",
                    borderRadius: 5,
                    border: "1px solid rgba(240,137,47,0.3)",
                    whiteSpace: "nowrap",
                    textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                  }}
                >
                  {ax}
                </span>
              </Html>
            </group>
          </group>
        )
      })}
      <RadarShape vals={B} color="#7d92ff" z={-0.03} />
      <RadarShape vals={A} color="#ffab5e" z={0.03} />
    </group>
  )
}

export default function DuelScene() {
  return <WebGlGuard />
}
