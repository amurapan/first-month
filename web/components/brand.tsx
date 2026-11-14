export function BrandMark() {
  return (
    <svg
      viewBox="0 0 52 52"
      fill="none"
      aria-hidden="true"
      className="brand-symbol"
    >
      <path
        className="brand-half first"
        d="M27 13a11 11 0 0 0-15 0l-5 5a11 11 0 0 0 0 15l5 5a11 11 0 0 0 15 0"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        className="brand-half second"
        d="M25 14a11 11 0 0 1 15 0l5 5a11 11 0 0 1 0 15l-5 5a11 11 0 0 1-15 0"
        stroke="var(--brand-accent, #dc7259)"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function Brand() {
  return (
    <a className="brand" href="/" aria-label="First Month home">
      <BrandMark />
      <span className="brand-wordmark">
        first month<span className="brand-dot">.</span>
      </span>
    </a>
  );
}
