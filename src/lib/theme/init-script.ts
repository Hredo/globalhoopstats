/**
 * Runs before first paint (injected inline in <head>) to set the theme
 * attribute, so the correct theme never flashes the wrong default.
 *
 * Precedence: an explicit saved choice ("light"/"dark") wins; otherwise we
 * follow the OS via `prefers-color-scheme` so a first-time visitor whose system
 * is in light mode lands on light, and vice-versa. Only "light" needs the
 * attribute set (dark is the CSS default). Kept tiny and dependency-free;
 * mirrors THEME_STORAGE_KEY.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("ghs-theme");var t=(s==="light"||s==="dark")?s:((window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark");if(t==="light"){document.documentElement.setAttribute("data-theme","light")}}catch(e){}})();`
