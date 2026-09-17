/**
 * Playbook feature toggles.
 *
 * Photo import is the only surface in the product that needs a vision model,
 * and a vision call is by some distance the most expensive request we make.
 * It stays OFF until the paid tier hosts its own inference and the spend has
 * a ceiling — see the go-to-market plan.
 *
 * One flag governs both sides: the route refuses the request and the UI never
 * offers it, so the feature cannot come back half-on. Turning it back on is a
 * deploy-time env change, not a code change:
 *
 *     NEXT_PUBLIC_PLAYBOOK_PHOTO_IMPORT=1
 *
 * `NEXT_PUBLIC_` because the client menu reads the same value; the server
 * still enforces it independently in the route handler, so a direct POST is
 * refused whatever the browser bundle happens to contain.
 */
export const PHOTO_IMPORT_ENABLED =
  process.env.NEXT_PUBLIC_PLAYBOOK_PHOTO_IMPORT === "1"
