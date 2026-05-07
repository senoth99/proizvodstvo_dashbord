"use client";

import { useState } from "react";
import { MaterialsTab } from "./MaterialsTab";
import { ProductsTab } from "./ProductsTab";
import { HealthIndicators } from "./HealthIndicators";
import { Button, Input } from "./ui";

type Section = "products" | "materials";

const SECTIONS: { id: Section; label: string; hint: string }[] = [
  { id: "materials", label: "Материалы", hint: "Склад и цены" },
  { id: "products", label: "Изделия", hint: "Спецификации (BOM)" },
];

const SETTINGS_PASSWORD = "Casher1337";

export function SettingsTab() {
  const [unlocked, setUnlocked] = useState(false);
  const [section, setSection] = useState<Section>("materials");

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--color-surface)] py-2 pr-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {SECTIONS.map((s) => {
            const active = section === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={
                  "h-10 px-3 sm:px-4 text-xs uppercase tracking-[0.16em] font-semibold transition-colors " +
                  (active
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-white/[0.04]")
                }
                title={s.hint}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <HealthIndicators />
      </div>

      {section === "products" && <ProductsTab />}
      {section === "materials" && <MaterialsTab />}
    </div>
  );
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (value === SETTINGS_PASSWORD) {
      onUnlock();
    } else {
      setError(true);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mx-auto w-full max-w-sm flex flex-col gap-4 py-12"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-[11px] font-light uppercase tracking-[0.24em]">
          Доступ к настройкам
        </h2>
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Введите пароль, чтобы продолжить
        </p>
      </div>
      <Input
        type="password"
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(false);
        }}
        placeholder="Пароль"
      />
      {error && (
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#d11a1a]">
          Неверный пароль
        </div>
      )}
      <Button type="submit" variant="primary" block disabled={value.length === 0}>
        Войти
      </Button>
    </form>
  );
}
