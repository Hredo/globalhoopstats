"use client"

export function SearchTrigger() {
  function open() {
    document.dispatchEvent(new CustomEvent("open-search-palette"))
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Search players"
      title="Ctrl+K"
      className="inline-flex h-8 w-8 items-center justify-center text-ink-400 transition hover:text-ink-50"
    >
      <svg
        aria-hidden
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m21 21-4.3-4.3M16.65 10.65a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z"
        />
      </svg>
    </button>
  )
}
