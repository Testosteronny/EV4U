import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { fmtCH } from "../utils/swiss";

/* ============================================================================
   UI-Primitive «Ladestand» (Konzept v3 §6.5).

   Regeln, die hier durchgesetzt werden:
   · Gemischtschreibung. Versal nur über `.eyebrow`.
   · Grün trägt Zustand und Aktion; Icons sind neutral. Ein grüner Button
     pro Ansicht.
   · Preise sind der lauteste Text: 700, Tabellenziffern.
   · Kein Text unter 13 px ausser `micro`.
   · Bewegung nur, wo sie Zustand erklärt. Overlays gehen per Portal an
     <body>, damit der backdrop-filter des Headers nie zum Containing Block
     wird.
   ============================================================================ */

/* ---------- Button -------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "onForest";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-line2 bg-surface text-fg hover:bg-surface2",
  ghost: "text-fg2 hover:bg-surface2 hover:text-fg",
  danger: "border border-line2 bg-surface text-danger hover:border-danger hover:bg-danger/5",
  onForest: "bg-volt text-forest hover:bg-on-forest",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-small",
  md: "h-11 px-5 text-body",
  lg: "h-12 px-6 text-body",
};

export const buttonClass = (variant: ButtonVariant = "secondary", size: ButtonSize = "md") =>
  `${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]}`;

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button type={type} {...rest} className={`${buttonClass(variant, size)} ${className}`} />;
}

/** Same look as Button, but a real link. */
export function LinkButton({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <a {...rest} className={`${buttonClass(variant, size)} ${className}`}>
      {children}
    </a>
  );
}

/** Square icon-only control — toolbar toggles, close buttons, card actions. */
export function IconButton({
  active = false,
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type={type}
      {...rest}
      aria-pressed={rest["aria-pressed"] ?? (active || undefined)}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-control border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-accent bg-soft text-accent"
          : "border-line2 bg-surface text-fg2 hover:bg-surface2 hover:text-fg"
      } ${className}`}
    />
  );
}

/* ---------- Status & Chips ------------------------------------------------ */

type BadgeTone = "neutral" | "positive" | "caution" | "danger" | "volt" | "photo";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-surface2 text-fg2",
  positive: "bg-soft text-accent",
  caution: "bg-caution-bg text-caution",
  danger: "bg-danger/10 text-danger",
  /** «Neu» — the electric highlight. */
  volt: "bg-volt text-forest",
  /** On top of a photo: legible on any image. */
  photo: "bg-black/65 text-white backdrop-blur-sm",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
  title,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-small font-semibold ${BADGE_TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Toggle chip (pill) — entry chips, filter options, intents. */
export function Chip({
  active = false,
  count,
  children,
  onClick,
  href,
  disabled,
  className = "",
}: {
  active?: boolean;
  count?: number;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  className?: string;
}) {
  const cls = `inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-small font-medium transition-colors ${
    active
      ? "border-accent bg-soft text-accent"
      : "border-line2 bg-surface text-fg hover:border-fg3"
  } ${disabled ? "pointer-events-none opacity-45" : ""} ${className}`;
  const inner = (
    <>
      {active && <Check size={14} aria-hidden />}
      {children}
      {count !== undefined && (
        <span className={`tabular ${active ? "text-accent" : "text-fg3"}`}>{count}</span>
      )}
    </>
  );
  if (href) {
    return (
      <a href={href} className={cls} aria-current={active ? "true" : undefined}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={active} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}

/** Aktiver Filter — klickbar, entfernt sich selbst. */
export function FilterChip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-soft pl-3 pr-2 text-small font-medium text-accent transition-colors hover:bg-accent hover:text-on-accent"
    >
      {children}
      <X size={14} aria-hidden />
      <span className="sr-only">entfernen</span>
    </button>
  );
}

/* ---------- Ladebalken ---------------------------------------------------- */

/** The 10-segment charge bar — SOH, range relative to the best, progress.
 *  Static: a bar that animates in starts from a wrong value. */
export function ChargeBar({
  value,
  max = 100,
  min = 0,
  label,
  className = "",
  tone = "bar",
}: {
  value: number;
  max?: number;
  min?: number;
  /** Accessible name, e.g. «Batteriezustand 94 %». */
  label: string;
  className?: string;
  tone?: "bar" | "caution" | "volt";
}) {
  const fill = Math.max(0, Math.min(10, ((value - min) / (max - min)) * 10));
  const color = tone === "caution" ? "bg-caution" : tone === "volt" ? "bg-volt" : "bg-bar";
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`chargebar h-2 w-full ${className}`}
    >
      {Array.from({ length: 10 }, (_, i) => {
        const part = Math.max(0, Math.min(1, fill - i));
        return (
          <span key={i} className="relative overflow-hidden rounded-[2px] bg-line">
            {part > 0 && (
              <span className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${part * 100}%` }} />
            )}
          </span>
        );
      })}
    </span>
  );
}

/* ---------- Fakten -------------------------------------------------------- */

/** Icon + value + label — key facts strip, spec rows. */
export function SpecItem({
  icon,
  value,
  label,
  className = "",
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      <span className="mt-0.5 text-fg3" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-body font-semibold text-fg tabular">{value}</div>
        <div className="text-small text-fg2">{label}</div>
      </div>
    </div>
  );
}

/** A dashboard tile with a big number. */
export function StatCard({
  title,
  value,
  hint,
  href,
  icon,
  children,
}: {
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-small font-medium text-fg2">{title}</span>
        {icon && <span className="text-fg3">{icon}</span>}
      </div>
      <div className="mt-2 text-display font-bold text-fg tabular">{value}</div>
      {hint && <div className="mt-1 text-small text-fg2">{hint}</div>}
      {children}
    </>
  );
  return href ? (
    <a href={href} className="card card-hover block p-5">
      {body}
    </a>
  ) : (
    <div className="card p-5">{body}</div>
  );
}

/* ---------- Kopfzeilen ---------------------------------------------------- */

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Brotkrumen" className="text-small text-fg2">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={13} className="text-fg3" aria-hidden />}
            {c.href && i < items.length - 1 ? (
              <a href={c.href} className="transition-colors hover:text-fg">
                {c.label}
              </a>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className="text-fg">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Seitentitel. Gemischt gesetzt, keine Entrance. */
export function PageHeader({
  title,
  lead,
  crumbs,
  children,
}: {
  title: string;
  lead?: ReactNode;
  crumbs?: Crumb[];
  children?: ReactNode;
}) {
  return (
    <div>
      {crumbs && (
        <div className="mb-3">
          <Breadcrumbs items={crumbs} />
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-display font-bold text-fg">{title}</h1>
          {lead && <p className="mt-1.5 max-w-prose text-body text-fg2">{lead}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Abschnittstitel innerhalb einer Seite, optional mit «Alle →». */
export function SectionHeader({
  title,
  lead,
  more,
  children,
}: {
  title: string;
  lead?: ReactNode;
  more?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div className="min-w-0">
        <h2 className="text-h2 font-bold text-fg">{title}</h2>
        {lead && <p className="mt-1 max-w-prose text-body text-fg2">{lead}</p>}
      </div>
      {more && (
        <a href={more.href} className="link inline-flex items-center gap-1 text-body font-semibold">
          {more.label}
          <ChevronRight size={16} aria-hidden />
        </a>
      )}
      {children}
    </div>
  );
}

/* ---------- Leerzustand --------------------------------------------------- */

export function EmptyState({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="card px-6 py-14 text-center">
      {icon && <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-faint text-accent">{icon}</div>}
      <p className="text-h3 font-semibold text-fg">{title}</p>
      {hint && <p className="mx-auto mt-2 max-w-prose text-body text-fg2">{hint}</p>}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

/** Inline notice — success, info or warning, one sentence or two. */
export function Notice({
  tone = "info",
  children,
  className = "",
}: {
  tone?: "info" | "success" | "caution" | "danger";
  children: ReactNode;
  className?: string;
}) {
  const cls = {
    info: "bg-surface2 text-fg2",
    success: "bg-soft text-accent",
    caution: "bg-caution-bg text-caution",
    danger: "bg-danger/10 text-danger",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-control px-4 py-3 text-small ${cls} ${className}`}>
      {children}
    </div>
  );
}

/* ---------- Eingaben ------------------------------------------------------ */

/** Label + Feld. */
export function Field({
  label,
  hint,
  children,
  optional = false,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-small font-semibold text-fg2">
        {label}
        {optional && <span className="ml-1 font-normal text-fg3">(optional)</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-micro text-fg3">{hint}</span>}
    </label>
  );
}

/** Native select in the field style. */
export function Select({
  className = "",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`field select-field ${className}`}>
      {children}
    </select>
  );
}

/** Switch for yes/no settings. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-body font-medium text-fg">{label}</span>
        {hint && <span className="block text-small text-fg2">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          checked ? "bg-accent" : "bg-line2"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5.5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

/** Checkbox row with an optional count — filter sidebar, checklists. */
export function CheckRow({
  checked,
  onChange,
  label,
  count,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-control px-1 py-1.5 text-body transition-colors hover:bg-surface2 ${
        disabled ? "pointer-events-none opacity-45" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4.5 w-4.5 shrink-0 accent-[rgb(var(--c-accent))]"
      />
      <span className="min-w-0 flex-1 truncate text-fg">{label}</span>
      {count !== undefined && <span className="text-small text-fg3 tabular">{count}</span>}
    </label>
  );
}

/** Slider mit Inline-Wert. `onCommit` feuert erst beim Loslassen. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  format = (v) => fmtCH(v),
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const commit = (e: React.SyntheticEvent<HTMLInputElement>) => onCommit?.(Number(e.currentTarget.value));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-small font-semibold text-fg2">{label}</span>
        <span className="text-body font-semibold text-fg tabular">
          {format(value)}
          {unit && <span className="ml-1 text-small font-normal text-fg3">{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        className="slider mt-1"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--val": `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        aria-label={label}
        aria-valuetext={`${format(value)}${unit ? ` ${unit}` : ""}`}
      />
    </div>
  );
}

/** Segmented control — nur für ≤ 4 Optionen. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className = "",
  label,
}: {
  options: { key: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex rounded-control border border-line2 bg-surface2 p-0.5 ${className}`}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            type="button"
            key={o.key}
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            title={o.title}
            className={`inline-flex items-center gap-1.5 rounded-[8px] font-semibold transition-colors ${
              size === "sm" ? "h-8 px-2.5 text-small" : "h-9 px-3.5 text-small"
            } ${active ? "bg-surface text-fg shadow-sm" : "text-fg2 hover:text-fg"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Einfachauswahl als umbrechende Pill-Reihe — für mehr als vier Optionen. */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            type="button"
            key={o.key}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.key)}
            title={o.hint}
            className={`h-9 rounded-full border px-3.5 text-small font-medium transition-colors ${
              active
                ? "border-accent bg-soft text-accent"
                : "border-line2 bg-surface text-fg2 hover:border-fg3 hover:text-fg"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Fortschritt --------------------------------------------------- */

/** Wizard steps. Done steps are links back; the current one is marked. */
export function Stepper({
  steps,
  current,
  reachable = current,
  onSelect,
}: {
  steps: string[];
  current: number;
  /** Highest step that may be opened (editing: all of them). */
  reachable?: number;
  onSelect?: (i: number) => void;
}) {
  return (
    <ol className="flex gap-1 overflow-x-auto no-scrollbar" aria-label="Schritte">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="min-w-0 flex-1">
            <button
              type="button"
              disabled={!onSelect || i > reachable}
              onClick={() => onSelect?.(i)}
              aria-current={active ? "step" : undefined}
              className="group w-full text-left disabled:cursor-default"
            >
              <span
                className={`block h-1.5 rounded-full ${done ? "bg-accent" : active ? "bg-bar/60" : "bg-line"}`}
              />
              <span
                className={`mt-1.5 hidden truncate text-small sm:block ${
                  active ? "font-semibold text-fg" : done ? "text-fg2 group-hover:text-fg" : "text-fg3"
                }`}
              >
                {i + 1}. {s}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Inserat-Qualität: score and the next best action. */
export function QualityMeter({
  score,
  next,
}: {
  score: number;
  next: { label: string; gain: number }[];
}) {
  const tone = score >= 80 ? "text-accent" : score >= 50 ? "text-fg" : "text-caution";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-small font-semibold text-fg2">Inserat-Qualität</span>
        <span className={`text-h2 font-bold tabular ${tone}`}>{score} %</span>
      </div>
      <ChargeBar value={score} label={`Inserat-Qualität ${score} %`} className="mt-2" />
      {next.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {next.slice(0, 3).map((n) => (
            <li key={n.label} className="flex items-start justify-between gap-3 text-small">
              <span className="text-fg2">{n.label}</span>
              <span className="shrink-0 font-semibold text-accent tabular">+{n.gain} %</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Zahlen -------------------------------------------------------- */

/** Zahl im Schweizer Format, mit Tabellenziffern. Bewusst ohne Animation:
 *  eine unterbrochene Zählung kann auf einem falschen Zwischenwert stehen. */
export function Num({ value, dec = 0 }: { value: number; dec?: number }) {
  return <span className="tabular">{fmtCH(value, dec)}</span>;
}

/** «CHF 36'900» in the price style. */
export function Price({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`font-bold text-fg tabular ${className}`}>
      CHF {fmtCH(value)}
    </span>
  );
}

/** Initials avatar — sellers, garages, the account menu. */
export function Avatar({ name, size = 36, className = "" }: { name: string; size?: number; className?: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-soft font-semibold text-accent ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

/* ---------- Overlays ------------------------------------------------------ */

/** Portal an <body>. Rendert erst nach dem Mount (SSR-sicher). */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Escape schliesst, Body-Scroll sperrt, der Fokus bleibt drin und kehrt
 *  danach dorthin zurück, wo er herkam. `panel` ist State und kein Ref: der
 *  Portal-Inhalt entsteht erst einen Render nach dem Öffnen. */
export function useModal(onClose: () => void, panel: HTMLElement | null) {
  // Callers pass inline closures; the effect must not re-run (and steal the
  // focus) on every parent render, so the latest one is read from a ref.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!panel) return;
    const opener = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel).focus({ preventScroll: true });

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      opener?.focus?.({ preventScroll: true });
    };
  }, [panel]);
}

/** Zentriertes Overlay auf Desktop, Bottom-Sheet auf dem Telefon.
 *  `side`: Drawer von rechts in voller Höhe (Filter auf dem Telefon). */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  wide = false,
  side = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  side?: boolean;
}) {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const titleId = useId();
  useModal(onClose, panel);

  return (
    <Portal>
      <div
        className={`fixed inset-0 z-80 flex bg-black/40 backdrop-blur-[2px] ${
          side ? "justify-end" : "items-end justify-center p-0 sm:items-center sm:p-6"
        }`}
        onClick={onClose}
      >
        <div
          ref={setPanel}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`animate-fade-in flex flex-col bg-surface outline-hidden ${
            side
              ? "h-full w-full max-w-md shadow-overlay"
              : `overlay-card max-h-[92vh] w-full rounded-b-none sm:rounded-b-overlay ${wide ? "max-w-2xl" : "max-w-lg"}`
          }`}
        >
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 id={titleId} className="text-h3 font-bold text-fg">
              {title}
            </h2>
            <IconButton onClick={onClose} aria-label="Schliessen" className="h-8 w-8">
              <X size={16} aria-hidden />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && (
            <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

/** Ankerndes Dropdown für kleine Auswahlen (Sortierung, Konto-Menü).
 *  Schliesst bei Klick ausserhalb und Escape. */
export function Dropdown({
  trigger,
  children,
  align = "left",
  width = 240,
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  width?: number;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrap}>
      {trigger({ open, toggle: () => setOpen((o) => !o), id })}
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          className={`overlay-card animate-fade-in absolute z-60 mt-1.5 max-h-[70vh] overflow-y-auto p-1.5 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{ width, maxWidth: "calc(100vw - 2rem)" }}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

/** Zeile in einem Dropdown: Bezeichnung links, optional Zahl rechts. */
export function MenuItem({
  children,
  onClick,
  href,
  active = false,
  icon,
  meta,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  icon?: ReactNode;
  meta?: ReactNode;
}) {
  const cls = `flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-body transition-colors ${
    active ? "bg-soft font-semibold text-accent" : "text-fg hover:bg-surface2"
  }`;
  const inner = (
    <>
      {icon && <span className={active ? "text-accent" : "text-fg3"}>{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {meta !== undefined && <span className="shrink-0 text-small text-fg3 tabular">{meta}</span>}
    </>
  );
  return href ? (
    <a href={href} role="menuitem" className={cls}>
      {inner}
    </a>
  ) : (
    <button type="button" role="menuitem" onClick={onClick} className={cls} aria-pressed={active}>
      {inner}
    </button>
  );
}

/** Aufklappbarer Block — Methodik, Filtergruppen, technische Daten. */
export function Disclosure({
  summary,
  children,
  open = false,
  className = "",
}: {
  summary: ReactNode;
  children: ReactNode;
  open?: boolean;
  className?: string;
}) {
  return (
    <details className={`group ${className}`} open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1 text-body font-semibold text-fg transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown size={16} aria-hidden className="shrink-0 text-fg3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
