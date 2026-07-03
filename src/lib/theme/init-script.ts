/**
 * Runs before first paint (injected inline in <body>) to set the theme
 * attribute, so the correct theme never flashes the wrong default.
 *
 * Precedence: an explicit saved choice ("light"/"dark") wins; otherwise we
 * follow the OS via `prefers-color-scheme` so a first-time visitor whose system
 * is in light mode lands on light, and vice-versa.
 *
 * Always sets the attribute explicitly — the CSS has
 * `html[data-theme="light"]` overrides for light mode; dark-mode variables are
 * the `:root` defaults and also apply under `html[data-theme="dark"]`.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("ghs-theme");var t=(s==="light"||s==="dark")?s:((window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark");document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`
