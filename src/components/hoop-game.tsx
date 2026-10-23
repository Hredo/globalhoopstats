"use client"

import { useEffect, useRef } from "react"

type HoopGameApi = { mount: (canvas: HTMLCanvasElement) => () => void }

declare global {
  interface Window {
    GHSHoopGame?: HoopGameApi
  }
}

const SCRIPT_SRC = "/hoop-game.js"

/**
 * The offline mini-game (public/hoop-game.js) inside a React page. The game is
 * plain JS so the service worker can serve it with no app bundle; here we just
 * load that same file once and mount it on our canvas. Keyboard input only
 * reaches it while the canvas has focus, so Space still scrolls the page.
 */
export function HoopGame({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let destroy: (() => void) | undefined
    let cancelled = false
    const start = () => {
      if (!cancelled && ref.current && window.GHSHoopGame) {
        destroy = window.GHSHoopGame.mount(ref.current)
      }
    }

    if (window.GHSHoopGame) {
      start()
    } else {
      let script = document.querySelector<HTMLScriptElement>(
        `script[src="${SCRIPT_SRC}"]`,
      )
      if (!script) {
        script = document.createElement("script")
        script.src = SCRIPT_SRC
        script.async = true
        document.body.appendChild(script)
      }
      script.addEventListener("load", start, { once: true })
    }

    return () => {
      cancelled = true
      destroy?.()
    }
  }, [])

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ touchAction: "manipulation" }}
    />
  )
}
