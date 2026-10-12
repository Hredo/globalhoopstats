"use client"

import { useEffect } from "react"

let shown = false

/**
 * Self-XSS warning in the DevTools console. Session cookies are HttpOnly and
 * nothing secret ships to the browser, so the remaining risk is social: someone
 * talking a user into pasting code here, which then runs as them.
 */
export function ConsoleWarning() {
  useEffect(() => {
    if (shown || process.env.NODE_ENV !== "production") return
    shown = true
    console.log(
      "%cStop! / ¡Alto!",
      "color:#e8761f;font-size:32px;font-weight:700",
    )
    console.log(
      "%cSi alguien te ha pedido pegar algo aquí, es un intento de robarte la cuenta. Pegar código en esta consola lo ejecuta en tu nombre.\n\nIf someone told you to paste something here, it is an attempt to take over your account. Code pasted into this console runs as you.",
      "font-size:14px",
    )
  }, [])
  return null
}
