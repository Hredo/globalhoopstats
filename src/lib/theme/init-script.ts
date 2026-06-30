/**
 * Runs before first paint (injected inline in <head>) to set the theme attribute
 * from the user's saved choice, so light mode never flashes the dark default.
 * Dark is the default — only an explicit "light" choice flips the attribute.
 * Kept tiny and dependency-free on purpose; mirrors THEME_STORAGE_KEY.
 */
export const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("ghs-theme")==="light"){document.documentElement.setAttribute("data-theme","light")}}catch(e){}})();`
