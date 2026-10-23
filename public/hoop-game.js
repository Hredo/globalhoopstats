/*
 * GlobalHoopStats — "Fast break", the offline mini-game.
 *
 * A side-scroller in the spirit of Chrome's offline dinosaur: dribble up the
 * floor, jump over defenders and throw it down when a hoop comes past.
 *
 * Plain JS with no build step and no dependencies on purpose: the service
 * worker caches this file next to /offline.html, so it has to run when nothing
 * else of the app can load. The 404 page reuses it through the HoopGame
 * component. Exposes `window.GHSHoopGame.mount(canvas) -> destroy`; canvases
 * marked `data-hoop-game="auto"` mount themselves and take keyboard input from
 * the whole page (only the standalone offline page does that).
 */
;(function () {
  "use strict"

  var H = 200 // logical height; width follows the canvas aspect ratio
  var GROUND = 172
  var GRAVITY = 1900
  var JUMP_V = -600
  var CUT_V = -230
  var START_SPEED = 270
  var MAX_SPEED = 640
  var BEST_KEY = "ghs-hoop-best"

  var TEXT = {
    es: {
      start: "Pulsa espacio o toca para jugar",
      restart: "Pulsa espacio o toca para reintentar",
      over: "¡TAPÓN!",
      dunk: "¡MATE! +100",
      best: "MÁX",
      label: "Minijuego de baloncesto: salta defensores y machaca en los aros",
    },
    en: {
      start: "Press space or tap to play",
      restart: "Press space or tap to try again",
      over: "BLOCKED!",
      dunk: "DUNK! +100",
      best: "HI",
      label: "Basketball mini-game: jump the defenders and dunk on the hoops",
    },
  }

  function langOf(el) {
    var tagged = el.closest("[lang]")
    var lang = (tagged && tagged.getAttribute("lang")) || navigator.language || "es"
    return lang.toLowerCase().indexOf("en") === 0 ? "en" : "es"
  }

  function readBest() {
    try {
      return parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0
    } catch (e) {
      return 0
    }
  }

  function writeBest(v) {
    try {
      localStorage.setItem(BEST_KEY, String(v))
    } catch (e) {
      /* private mode: the record just doesn't persist */
    }
  }

  function rand(a, b) {
    return a + Math.random() * (b - a)
  }

  function mount(canvas, opts) {
    var global = !!(opts && opts.global)
    var ctx = canvas.getContext("2d")
    if (!ctx) return function () {}
    var t = TEXT[langOf(canvas)]
    canvas.setAttribute("role", "img")
    canvas.setAttribute("aria-label", t.label)
    if (!global) canvas.tabIndex = 0

    var W = 600
    var scale = 1
    var colors = { ink: "#222", muted: "#888", accent: "#e8751a", line: "#ccc" }
    var font = "Space Mono, ui-monospace, monospace"

    var state = "ready" // ready | running | over
    var speed = START_SPEED
    var score = 0
    var best = readBest()
    var overAt = 0
    var clock = 0
    var floorOffset = 0
    var items = []
    var popups = []
    var nextGap = 0
    var sinceHoop = 0
    var raf = 0
    var last = 0
    var colorTick = 0

    var p = { x: 56, y: GROUND, vy: 0, onGround: true }

    function readColors() {
      var cs = getComputedStyle(canvas)
      colors.ink = cs.color || colors.ink
      colors.muted = cs.getPropertyValue("--hoop-muted").trim() || colors.muted
      colors.accent = cs.getPropertyValue("--hoop-accent").trim() || colors.accent
      colors.line = cs.getPropertyValue("--hoop-line").trim() || colors.line
    }

    function resize() {
      var rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      var dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      scale = canvas.height / H
      W = canvas.width / scale
      draw()
    }

    function reset() {
      state = "running"
      speed = START_SPEED
      score = 0
      clock = 0
      items = []
      popups = []
      nextGap = W * 0.6
      sinceHoop = 0
      p.y = GROUND
      p.vy = 0
      p.onGround = true
      readColors()
    }

    function press() {
      if (state === "ready") {
        reset()
        return
      }
      if (state === "over") {
        if (performance.now() - overAt > 450) reset()
        return
      }
      if (p.onGround) {
        p.vy = JUMP_V
        p.onGround = false
      }
    }

    // Letting go early cuts the jump short, so a tap clears a guard and a
    // held press reaches the rim.
    function release() {
      if (state === "running" && p.vy < CUT_V) p.vy = CUT_V
    }

    function spawn() {
      var x = W + 20
      if (sinceHoop >= 4 && score > 30 && Math.random() < 0.3) {
        items.push({ kind: "hoop", x: x, w: 26, dunked: false, shake: 0 })
        sinceHoop = 0
        nextGap = speed * rand(0.9, 1.3) + 80
        return
      }
      sinceHoop++
      var r = Math.random()
      if (r < 0.5 || score < 40) {
        items.push({ kind: "guard", x: x, w: 16, h: 30 })
      } else if (r < 0.8) {
        items.push({ kind: "center", x: x, w: 16, h: 46 })
      } else {
        items.push({ kind: "double", x: x, w: 36, h: 30 })
      }
      nextGap = speed * rand(0.78, 1.5) + 60
    }

    function hit(o) {
      var px1 = p.x - 6
      var px2 = p.x + 6
      var ox1 = o.x + 3
      var ox2 = o.x + o.w - 3
      var oy1 = GROUND - o.h + 4
      return px2 > ox1 && px1 < ox2 && p.y > oy1
    }

    function update(dt) {
      clock += dt
      if (state !== "running") return
      speed = Math.min(MAX_SPEED, speed + 7 * dt)
      score += (speed * dt) / 40
      var dx = speed * dt
      floorOffset = (floorOffset + dx) % 48

      if (!p.onGround) {
        p.vy += GRAVITY * dt
        p.y += p.vy * dt
        if (p.y >= GROUND) {
          p.y = GROUND
          p.vy = 0
          p.onGround = true
        }
      }

      nextGap -= dx
      if (nextGap <= 0) spawn()

      for (var i = items.length - 1; i >= 0; i--) {
        var o = items[i]
        o.x -= dx
        if (o.x + o.w < -40) {
          items.splice(i, 1)
          continue
        }
        if (o.kind === "hoop") {
          if (o.shake > 0) o.shake -= dt
          var rimY = GROUND - 96
          var handY = p.y - 50
          if (!o.dunked && !p.onGround && handY <= rimY + 6 && p.x > o.x - 6 && p.x < o.x + o.w + 4) {
            o.dunked = true
            o.shake = 0.5
            score += 100
            popups.push({ x: o.x + 13, y: rimY - 18, life: 1, text: t.dunk })
          }
        } else if (hit(o)) {
          state = "over"
          overAt = performance.now()
          var s = Math.floor(score)
          if (s > best) {
            best = s
            writeBest(best)
          }
        }
      }

      for (var j = popups.length - 1; j >= 0; j--) {
        popups[j].life -= dt
        popups[j].y -= 22 * dt
        if (popups[j].life <= 0) popups.splice(j, 1)
      }
    }

    function line(x1, y1, x2, y2) {
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }

    function drawBall(x, y) {
      ctx.fillStyle = colors.accent
      ctx.beginPath()
      ctx.arc(x, y, 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = colors.ink
      ctx.lineWidth = 0.8
      line(x - 4.5, y, x + 4.5, y)
      line(x, y - 4.5, x, y + 4.5)
    }

    function drawPlayer() {
      var x = p.x
      var y = p.y
      var air = !p.onGround
      var phase = state === "running" ? clock * speed * 0.045 : 0
      ctx.strokeStyle = colors.ink
      ctx.fillStyle = colors.ink
      ctx.lineCap = "round"
      ctx.lineWidth = 3
      var hip = y - 15
      if (air) {
        line(x, hip, x - 6, y - 6)
        line(x, hip, x + 5, y - 4)
      } else {
        var s = Math.sin(phase) * 6
        line(x, hip, x + s, y)
        line(x, hip, x - s, y)
      }
      line(x, hip, x + 2, y - 29)
      ctx.beginPath()
      ctx.arc(x + 3, y - 35, 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 2.5
      if (air) {
        // ball cocked above the head for the dunk
        line(x + 2, y - 27, x + 7, y - 44)
        line(x + 2, y - 27, x - 3, y - 42)
        drawBall(x + 4, y - 50)
      } else {
        // dribble: floor to hand on every bounce
        var bounce = Math.abs(Math.sin(phase * 0.5))
        var by = y - 4 - bounce * 12
        line(x + 2, y - 26, x + 10, y - 17 - bounce * 2)
        line(x + 2, y - 26, x - 6, y - 18)
        drawBall(x + 12, by)
      }
    }

    function drawDefender(o) {
      ctx.strokeStyle = colors.muted
      ctx.fillStyle = colors.muted
      ctx.lineCap = "round"
      var count = o.kind === "double" ? 2 : 1
      for (var k = 0; k < count; k++) {
        var cx = o.x + 8 + k * 20
        var tall = o.kind === "center"
        var top = GROUND - (tall ? 40 : 26)
        ctx.lineWidth = 3
        line(cx, GROUND, cx - 4, GROUND - 12)
        line(cx, GROUND, cx + 4, GROUND - 12)
        line(cx - 4, GROUND - 12, cx, top + 8)
        line(cx + 4, GROUND - 12, cx, top + 8)
        line(cx, top + 8, cx, GROUND - 13)
        ctx.beginPath()
        ctx.arc(cx, top + 2, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.lineWidth = 2.5
        if (tall) {
          // arms straight up: the rim protector
          line(cx, top + 9, cx - 5, top - 6)
          line(cx, top + 9, cx + 5, top - 6)
        } else {
          // low stance, arms wide
          line(cx, top + 10, cx - 9, top + 6)
          line(cx, top + 10, cx + 9, top + 6)
        }
      }
    }

    function drawHoop(o) {
      var rimY = GROUND - 96
      var bx = o.x + o.w
      var sh = o.shake > 0 ? Math.sin(o.shake * 60) * 1.5 : 0
      ctx.strokeStyle = colors.ink
      ctx.lineCap = "round"
      ctx.lineWidth = 2
      line(bx + 2, 0, bx + 2, rimY - 26)
      ctx.lineWidth = 3
      line(bx + 2, rimY - 26 + sh, bx + 2, rimY + 6 + sh)
      ctx.strokeStyle = colors.accent
      ctx.lineWidth = 2.5
      line(o.x, rimY + sh, bx, rimY + sh)
      ctx.strokeStyle = colors.muted
      ctx.lineWidth = 1
      var sway = o.shake > 0 ? Math.sin(o.shake * 40) * 3 : 0
      for (var n = 0; n <= 4; n++) {
        var nx = o.x + (o.w / 4) * n
        line(nx, rimY + sh, o.x + 5 + ((o.w - 10) / 4) * n + sway, rimY + 16)
      }
      if (o.dunked && o.shake > 0) drawBall(o.x + o.w / 2 + sway, rimY + 10 + (0.5 - o.shake) * 60)
    }

    function drawFloor() {
      ctx.strokeStyle = colors.line
      ctx.lineWidth = 1.5
      line(0, GROUND + 1, W, GROUND + 1)
      ctx.lineWidth = 1
      for (var x = -floorOffset; x < W; x += 48) {
        line(x, GROUND + 7, x + 18, GROUND + 7)
        line(x + 26, GROUND + 14, x + 36, GROUND + 14)
      }
    }

    function pad(n) {
      var s = String(Math.floor(n))
      while (s.length < 5) s = "0" + s
      return s
    }

    function draw() {
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.clearRect(0, 0, W, H)
      drawFloor()
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === "hoop") drawHoop(items[i])
        else drawDefender(items[i])
      }
      drawPlayer()

      ctx.textBaseline = "top"
      ctx.textAlign = "right"
      ctx.font = "bold 12px " + font
      var scoreText = pad(score)
      ctx.fillStyle = colors.muted
      ctx.fillText(t.best + " " + pad(best) + "  ", W - 12 - ctx.measureText(scoreText).width, 12)
      ctx.fillStyle = colors.ink
      ctx.fillText(scoreText, W - 12, 12)

      ctx.textAlign = "center"
      ctx.font = "bold 11px " + font
      ctx.fillStyle = colors.accent
      for (var j = 0; j < popups.length; j++) {
        ctx.globalAlpha = Math.max(0, popups[j].life)
        ctx.fillText(popups[j].text, popups[j].x, popups[j].y)
      }
      ctx.globalAlpha = 1

      if (state !== "running") {
        if (state === "over") {
          ctx.fillStyle = colors.ink
          ctx.font = "bold 18px " + font
          ctx.fillText(t.over, W / 2, 62)
        }
        ctx.font = "12px " + font
        ctx.fillStyle = colors.muted
        ctx.fillText(state === "over" ? t.restart : t.start, W / 2, state === "over" ? 90 : 76)
      }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame)
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      if (++colorTick % 60 === 0) readColors()
      update(dt)
      draw()
    }

    function isJumpKey(e) {
      return e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW"
    }

    function onKeyDown(e) {
      if (!isJumpKey(e)) return
      e.preventDefault()
      if (!e.repeat) press()
    }

    function onKeyUp(e) {
      if (isJumpKey(e)) release()
    }

    function onPointerDown(e) {
      e.preventDefault()
      if (!global) canvas.focus({ preventScroll: true })
      press()
    }

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
      } else if (!raf) {
        last = 0
        raf = requestAnimationFrame(frame)
      }
    }

    var keyTarget = global ? window : canvas
    keyTarget.addEventListener("keydown", onKeyDown)
    keyTarget.addEventListener("keyup", onKeyUp)
    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("pointerup", release)
    canvas.addEventListener("pointerleave", release)
    document.addEventListener("visibilitychange", onVisibility)
    var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null
    if (ro) ro.observe(canvas)
    else window.addEventListener("resize", resize)

    readColors()
    resize()
    raf = requestAnimationFrame(frame)

    return function destroy() {
      cancelAnimationFrame(raf)
      keyTarget.removeEventListener("keydown", onKeyDown)
      keyTarget.removeEventListener("keyup", onKeyUp)
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointerup", release)
      canvas.removeEventListener("pointerleave", release)
      document.removeEventListener("visibilitychange", onVisibility)
      if (ro) ro.disconnect()
      else window.removeEventListener("resize", resize)
    }
  }

  window.GHSHoopGame = { mount: mount }

  // /offline.html has no React and no inline scripts (the CSP forbids them),
  // so its locale, theme and retry button are wired here. Same cookie and
  // storage keys as the app (ghs_locale, ghs-theme).
  function setupOfflinePage() {
    var root = document.documentElement
    var m = /(?:^|;\s*)ghs_locale=(es|en)/.exec(document.cookie)
    var lang = m ? m[1] : (navigator.language || "es").toLowerCase().indexOf("en") === 0 ? "en" : "es"
    root.setAttribute("lang", lang)
    var nodes = document.querySelectorAll("[data-es]")
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = nodes[i].getAttribute("data-" + lang)
    }
    document.title = lang === "en" ? "Offline · GlobalHoopStats" : "Sin conexión · GlobalHoopStats"
    try {
      var saved = localStorage.getItem("ghs-theme")
      if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved)
    } catch (e) {
      /* fall back to prefers-color-scheme */
    }
    var retry = document.querySelector("[data-offline-retry]")
    if (retry) retry.addEventListener("click", function () { location.reload() })
    window.addEventListener("online", function () {
      root.setAttribute("data-online", "true")
    })
  }

  function autoMount() {
    if (document.body && document.body.hasAttribute("data-offline-page")) setupOfflinePage()
    var list = document.querySelectorAll('canvas[data-hoop-game="auto"]')
    for (var i = 0; i < list.length; i++) mount(list[i], { global: true })
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount)
  } else {
    autoMount()
  }
})()
