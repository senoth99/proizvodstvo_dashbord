"use client";

export type View = "production" | "main" | "settings" | "manager";

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
        <div className="h-14 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div />
          <a href="#" aria-label="На главную" className="block select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.gif"
              alt="Логотип"
              draggable={false}
              className="h-9 w-auto object-contain pointer-events-none"
            />
          </a>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setView("manager")}
              aria-current={view === "manager" ? "page" : undefined}
              className={
                "h-9 px-3 text-[8px] sm:text-[9px] font-light uppercase tracking-[0.12em] transition-colors " +
                (view === "manager"
                  ? "bg-[var(--color-accent)] text-[var(--color-foreground)]"
                  : "bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]")
              }
            >
              <span className="inline-block origin-center scale-[0.42] leading-none">
                Панель манагера
              </span>
            </button>
          </div>
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
                "h-14 w-full px-2 inline-flex items-center justify-center text-center text-[6px] sm:text-[7px] font-light uppercase tracking-[0.22em] transition-colors " +
                (active
                  ? "bg-[var(--color-accent)] text-[var(--color-foreground)]"
                  : "bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]")
              }
            >
              <span className="origin-center scale-[0.55]">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
