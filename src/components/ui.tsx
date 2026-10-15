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
import { X } from "lucide-react";
import { fmtCH } from "../utils/swiss";

/* ============================================================================
   UI-Primitive «Klartext».

   Regeln, die hier durchgesetzt werden:
   · Gemischtschreibung. Versal nur über `.eyebrow`.
   · Der Akzent trägt genau vier Rollen: Primärbutton, aktiver Zustand,
     Fokusring, Link. Icons sind neutral.
   · Kein Text unter 13 px ausser `micro` (Rechtliches).
   · Bewegung nur, wo sie Zustand erklärt — CSS-Transitions, kein Framer
     Motion. Overlays gehen per Portal an <body>, damit der backdrop-filter
     des Headers nie zum Containing Block wird.
   ============================================================================ */

/* ---------- Button -------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-card font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-line2 bg-surface text-fg hover:bg-surface2",
  ghost: "text-fg2 hover:bg-surface2 hover:text-fg",
  danger: "border border-line2 bg-surface text-fg2 hover:border-caution hover:text-caution",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-small",
  md: "h-11 px-5 text-body",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      {...rest}
      className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${className}`}
    />
  );
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
    <a
      {...rest}
      className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${className}`}
    >
      {children}
    </a>
  );
}

/** Square icon-only control — toolbar toggles, close buttons, card actions. */
export function IconButton({
  active = false,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...rest}
      aria-pressed={rest["aria-pressed"] ?? (active || undefined)}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-card border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-accent bg-accent text-on-accent"
          : "border-line2 bg-surface text-fg2 hover:bg-surface2 hover:text-fg"
      } ${className}`}
    />
  );
}

/* ---------- Status & Chips ------------------------------------------------ */

type BadgeTone = "neutral" | "positive" | "caution";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-surface2 text-fg2",
  positive: "bg-accent/10 text-accent",
  caution: "bg-caution/10 text-caution",
};

/** Status marker — ersetzt den rotierten Gummistempel. */
export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-chip px-2 py-1 text-small font-medium ${BADGE_TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Aktiver Filter — klickbar, entfernt sich selbst. */
export function FilterChip({
  children,
  onRemove,
}: {
  children: ReactNode;
  onRemove: () => void;
}) {
  return (
    <button
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 rounded-chip border border-line2 bg-surface px-2.5 py-1 text-small text-fg transition-colors hover:border-fg3 hover:bg-surface2"
    >
      {children}
      <X size={13} className="text-fg3" aria-hidden />
      <span className="sr-only">entfernen</span>
    </button>
  );
}

/* ---------- Kopfzeilen ---------------------------------------------------- */

/** Seitentitel. Gemischt gesetzt, keine Nummerierung, keine Entrance. */
export function PageHeader({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div>
        <h1 className="text-display font-semibold text-fg">{title}</h1>
        {lead && <p className="mt-1.5 max-w-prose text-body text-fg2">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

/** Abschnittstitel innerhalb einer Seite. */
export function SectionHeader({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div>
        <h2 className="text-h2 font-semibold text-fg">{title}</h2>
        {lead && <p className="mt-1 max-w-prose text-body text-fg2">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

/* ---------- Leerzustand --------------------------------------------------- */

/** Hilft beim Weiterkommen statt einen Witz zu machen. */
export function EmptyState({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="card px-6 py-14 text-center">
      <p className="text-h3 font-semibold text-fg">{title}</p>
      {hint && <p className="mx-auto mt-2 max-w-prose text-body text-fg2">{hint}</p>}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

/* ---------- Eingaben ------------------------------------------------------ */

/** Label + Feld. Das Label ist 13 px gemischt — nicht 9 px Versal-Mono. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-small font-medium text-fg2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-micro text-fg3">{hint}</span>}
    </label>
  );
}

/** Slider mit Inline-Wert. Ersetzt den Mischpult-Fader samt Lineal-Ticks.
 *
 *  `onCommit` feuert erst beim Loslassen. Wo ein Zug teuer ist — der
 *  Preisfilter schreibt die URL und filtert den ganzen Katalog neu —, gehört
 *  die Arbeit dorthin und nicht in jedes einzelne `change`-Ereignis. */
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
  const commit = (e: React.SyntheticEvent<HTMLInputElement>) =>
    onCommit?.(Number(e.currentTarget.value));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-small font-medium text-fg2">{label}</span>
        <span className="text-body font-medium text-fg tabular">
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

/** Segmented control — gemischt gesetzt, gerundet. Nur für ≤ 4 Optionen; ab 5
 *  gehört die Auswahl in ein <select> oder eine Chip-Reihe. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className = "",
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex rounded-card border border-line2 bg-surface2 p-0.5 ${className}`}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className={`rounded-[7px] font-medium transition-colors ${
              size === "sm" ? "h-8 px-2.5 text-small" : "h-9 px-3.5 text-small"
            } ${
              active
                ? "bg-accent text-on-accent"
                : "text-fg2 hover:text-fg"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Einfachauswahl als umbrechende Chip-Reihe — die Variante für mehr als
 *  vier Optionen, für die `Segmented` zu eng wird. Anders als ein <select>
 *  bleiben alle Möglichkeiten sichtbar, was bei einer Wahl zählt, die den
 *  Rest der Seite umrechnet. */
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
    <div role="radiogroup" aria-label={label}>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = o.key === value;
          return (
            <button
              key={o.key}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.key)}
              title={o.hint}
              className={`rounded-chip border px-3 py-1.5 text-small font-medium transition-colors ${
                active
                  ? "border-accent bg-accent text-on-accent"
                  : "border-line2 bg-surface text-fg2 hover:bg-surface2 hover:text-fg"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Zahlen -------------------------------------------------------- */

/** Zahl im Schweizer Format, mit Tabellenziffern.
 *
 *  Bewusst ohne Animation. Vorher lief hier eine federgetriebene Tacho-Zahl,
 *  rund zwanzigmal allein in der Kostenrechnung — beim Ziehen eines Reglers
 *  zappelte das ganze Ergebnispanel. Schlimmer: eine unterbrochene Zählung
 *  konnte auf einem Zwischenbild stehen bleiben, so dass die Ersparnis-
 *  Headline ihrer eigenen Aufschlüsselung widersprach (1'940 statt 2'031).
 *  Eine Zahl, die falsch sein kann, ist die Bewegung nicht wert. */
export function Num({ value, dec = 0 }: { value: number; dec?: number }) {
  return <span className="tabular">{fmtCH(value, dec)}</span>;
}

/* ---------- Overlays ------------------------------------------------------ */

/** Portal an <body> — der backdrop-filter des Headers darf fixed-Overlays
 *  nicht clippen. Rendert erst nach dem Mount (SSR-sicher). */
function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Escape schliesst, Body-Scroll sperrt, der Fokus bleibt drin und kehrt
 *  danach dorthin zurück, wo er herkam. Ohne das steht der Fokus hinter dem
 *  Overlay auf einer Seite, die man nicht mehr sieht — mit der Tastatur ist
 *  ein solches Panel unbedienbar.
 *
 *  `panel` ist bewusst State und kein Ref: der Portal-Inhalt entsteht erst
 *  einen Render nach dem Öffnen, und ein Ref wäre in dem Moment, in dem
 *  dieser Effekt zum ersten Mal liefe, noch leer — der Fokus bliebe dann
 *  stillschweigend draussen. Über State läuft der Effekt erneut, sobald der
 *  Knoten wirklich hängt. */
function useModal(onClose: () => void, panel: HTMLElement | null) {
  useEffect(() => {
    if (!panel) return;
    const opener = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
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

    // Erstes bedienbares Element, sonst das Panel selbst.
    (panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel).focus({ preventScroll: true });

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      opener?.focus?.({ preventScroll: true });
    };
  }, [onClose, panel]);
}

/** Zentriertes Overlay auf Desktop, Bottom-Sheet auf dem Telefon. */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const titleId = useId();
  useModal(onClose, panel);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-80 flex items-end justify-center bg-fg/25 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
        onClick={onClose}
      >
        <div
          ref={setPanel}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`overlay-card animate-fade-in flex max-h-[92vh] w-full flex-col rounded-b-none outline-hidden sm:rounded-b-overlay ${
            wide ? "max-w-2xl" : "max-w-lg"
          }`}
        >
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 id={titleId} className="text-h3 font-semibold text-fg">
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

/** Ankerndes Popover — Basis der Filter-Dropdowns auf /inserate.
 *  Auf dem Telefon fällt es auf ein Bottom-Sheet zurück: ein 280 px breites
 *  Dropdown am rechten Rand eines 360-px-Schirms ragt sonst aus dem Bild. */
export function Popover({
  label,
  summary,
  active = false,
  children,
  width = 260,
}: {
  label: string;
  /** Kurzfassung des gesetzten Werts, ersetzt das Label wenn aktiv. */
  summary?: string;
  active?: boolean;
  children: (close: () => void) => ReactNode;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [asSheet, setAsSheet] = useState(false);
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

  // Erst beim Öffnen entscheiden, nicht beim Rendern: sonst wäre der Wert im
  // vorgerenderten HTML geraten und die Hydration schlüge fehl.
  const toggle = () => {
    setAsSheet(window.matchMedia("(max-width: 639px)").matches);
    setOpen((o) => !o);
  };

  const trigger = (
    <button
      onClick={toggle}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-controls={open ? id : undefined}
      className={`inline-flex h-9 items-center gap-1.5 rounded-card border px-3 text-small font-medium transition-colors ${
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-line2 bg-surface text-fg2 hover:bg-surface2 hover:text-fg"
      }`}
    >
      {active && summary ? summary : label}
      <svg
        width="10"
        height="6"
        viewBox="0 0 10 6"
        aria-hidden
        className={`transition-transform ${open ? "rotate-180" : ""}`}
      >
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </button>
  );

  if (open && asSheet) {
    return (
      <div className="relative" ref={wrap}>
        {trigger}
        <Sheet title={label} onClose={close}>
          {children(close)}
        </Sheet>
      </div>
    );
  }

  return (
    <div className="relative" ref={wrap}>
      {trigger}
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className="overlay-card animate-fade-in absolute left-0 z-50 mt-1.5 max-h-[70vh] overflow-y-auto p-3"
          style={{ width, maxWidth: "calc(100vw - 2rem)" }}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

/** Zeile in einem Filter-Popover: Bezeichnung links, Trefferzahl rechts. */
export function OptionRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center justify-between gap-3 rounded-chip px-2.5 py-2 text-left text-body transition-colors ${
        active ? "bg-accent/10 font-medium text-accent" : "text-fg hover:bg-surface2"
      }`}
    >
      <span className="truncate">{label}</span>
      {count !== undefined && (
        <span className={`shrink-0 text-small tabular ${active ? "text-accent" : "text-fg3"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

/** Aufklappbarer Detailblock — nimmt den Modell-Disclaimer aus dem Blickfeld,
 *  ohne ihn zu verstecken. */
export function Disclosure({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-small font-medium text-fg2 transition-colors hover:text-fg">
        {summary}
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          aria-hidden
          className="transition-transform group-open:rotate-180"
        >
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
