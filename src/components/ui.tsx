"use client";

import * as React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  block?: boolean;
};

const buttonClasses = (
  variant: ButtonVariant,
  size: "sm" | "md" | "lg",
  block?: boolean
) => {
  const base =
    "inline-flex items-center justify-center gap-2 font-light tracking-[0.22em] uppercase " +
    "transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] " +
    "disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
  const sizes: Record<string, string> = {
    sm: "h-9 px-3 text-[13px]",
    md: "h-11 px-5 text-[15px]",
    lg: "h-16 px-6 text-[17px]",
  };
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-[var(--color-accent)] text-[var(--color-foreground)] hover:opacity-90",
    secondary:
      "bg-[var(--color-surface)] text-[var(--color-foreground)] hover:bg-[color-mix(in_srgb,white_8%,var(--color-background))]",
    ghost:
      "text-[var(--color-foreground)] hover:bg-[var(--color-surface)]",
    danger:
      "bg-[var(--color-surface)] text-[var(--color-foreground)] hover:bg-[color-mix(in_srgb,white_8%,var(--color-background))]",
  };
  return [
    base,
    sizes[size],
    variants[variant],
    block ? "w-full" : "",
  ].join(" ");
};

export function Button({
  variant = "secondary",
  size = "md",
  block,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`${buttonClasses(variant, size, block)} ${className}`}
    />
  );
}

export function Card({
  children,
  className = "",
  title,
  actions,
  bare,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  bare?: boolean;
}) {
  return (
    <section
      className={
        (bare ? "bg-transparent" : "bg-[var(--color-surface)]") +
        " " +
        className
      }
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-5 py-4">
          {title && (
            <h2 className="text-[11px] font-light uppercase tracking-[0.24em] text-[var(--color-foreground)]">
              {title}
            </h2>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className = "", ...rest }, ref) {
    return (
      <input
        ref={ref}
        {...rest}
        className={
          "h-10 px-3 bg-[var(--color-surface)] text-[var(--color-foreground)] outline outline-1 outline-transparent " +
          "focus:outline-none focus:bg-[color-mix(in_srgb,var(--color-accent)_18%,var(--color-surface))] " +
          "placeholder:text-[var(--color-muted)] " +
          className
        }
      />
    );
  }
);

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className = "", children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        {...rest}
        className={
          "h-10 px-2 bg-[var(--color-surface)] text-[var(--color-foreground)] " +
          "focus:outline-none focus:bg-[color-mix(in_srgb,var(--color-accent)_18%,var(--color-surface))] " +
          className
        }
      >
        {children}
      </select>
    );
  }
);

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className = "", ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        {...rest}
        className={
          "min-h-[80px] px-3 py-2 bg-[var(--color-surface)] text-[var(--color-foreground)] " +
          "focus:outline-none focus:bg-[color-mix(in_srgb,var(--color-accent)_18%,var(--color-surface))] " +
          "placeholder:text-[var(--color-muted)] resize-y " +
          className
        }
      />
    );
  }
);

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${className}`}>
      <span className="text-[var(--color-muted)] text-[10px] uppercase tracking-[0.22em] font-light">
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-xs text-[var(--color-muted)]">{hint}</span>
      )}
    </label>
  );
}

export function Badge({
  tone = "default",
  children,
}: {
  tone?: "default" | "accent" | "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    default: "bg-[var(--color-surface)] text-[var(--color-foreground)]",
    accent: "bg-[var(--color-accent)] text-[var(--color-foreground)]",
    success: "bg-[var(--color-accent)] text-[var(--color-foreground)]",
    warning: "bg-[var(--color-surface)] text-[var(--color-foreground)]",
    danger: "bg-[var(--color-surface)] text-[var(--color-foreground)]",
  };
  return (
    <span
      className={`inline-flex items-center px-2 h-6 text-[11px] uppercase tracking-[0.18em] font-light ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center text-sm text-[var(--color-muted)] py-10">
      {children}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  headerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-background)] w-full sm:max-w-lg shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h3 className="text-[11px] font-light uppercase tracking-[0.24em] truncate">
            {title}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {headerExtra}
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="h-8 w-8 inline-flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface)]"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div className="px-5 py-4 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="inline-flex items-center bg-[var(--color-surface)]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={
              "h-10 px-5 inline-flex items-center gap-2 text-[13px] uppercase tracking-[0.22em] font-light transition-colors " +
              (active
                ? "bg-[var(--color-accent)] text-[var(--color-foreground)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]")
            }
          >
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
