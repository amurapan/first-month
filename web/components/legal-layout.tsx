import { Brand } from "./brand";
export default function LegalLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="legal-shell">
      <header>
        <Brand />
        <a href="/">Back to First Month</a>
      </header>
      <main>
        <p className="eyebrow">FIRST MONTH · UPDATED NOVEMBER 14, 2026</p>
        <h1>{title}</h1>
        {children}
      </main>
      <footer>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="mailto:kudomiya@proton.me">Contact support</a>
      </footer>
    </div>
  );
}
