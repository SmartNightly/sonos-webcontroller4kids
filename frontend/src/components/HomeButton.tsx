import './HomeButton.css'

export function HomeButton({ onHome, className = '' }: { onHome: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={`kids-home ${className}`}
      aria-label="Zur Startseite"
      title="Zur Startseite"
      onClick={(event) => {
        event.currentTarget.focus()
        onHome()
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9" />
      </svg>
    </button>
  )
}
