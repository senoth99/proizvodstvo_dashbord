"use client";

export type View = "production" | "main" | "settings";

interface Props {
  view: View;
  setView: (v: View) => void;
}

const TABS: { id: View; label: string }[] = [
  { id: "production", label: "На производство" },
  { id: "main", label: "Главная" },
  { id: "settings", label: "Настройки" },
];

export function Header({ view, setView }: Props) {
  return (
    <header className="sticky top-0 z-20 bg-[var(--color-background)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-14 flex items-center justify-center">
          <a href="#" aria-label="На главную" className="block select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.gif"
              alt="Логотип"
              draggable={false}
              className="h-9 w-auto object-contain pointer-events-none"
            />
          </a>
        </div>
      </div>

      <nav
        className="grid grid-cols-3 w-full"
        aria-label="Навигация"
      >
        {TABS.map((t) => {
          const active = view === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              aria-current={active ? "page" : undefined}
              className={
                "h-14 w-full px-2 inline-flex items-center justify-center text-center text-[11px] sm:text-[13px] font-light uppercase tracking-[0.22em] transition-colors " +
                (active
                  ? "bg-[var(--color-accent)] text-[var(--color-foreground)]"
                  : "bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]")
              }
            >
              {t.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
