import { useEffect, useState, type ReactNode } from "react";
import { motion, useSpring } from "framer-motion";
import { fmtCH } from "../utils/swiss";

/* ============================================================================
   Shared UI primitives:
   · AnimatedNumber  — spring-driven odometer for CHF / km values
   · Fader           — range slider with ruler ticks
   · SectionHeader   — section intro (title + readable subline)
   · Stamp           — status chip (GESPEICHERT / EMPFOHLEN / GEBUCHT)
   · Segmented       — segmented control for filters & profiles
   ============================================================================ */

/** Spring-animated number, formatted Swiss style (18'420). */
export function AnimatedNumber({ value, dec = 0 }: { value: number; dec?: number }) {
  const spring = useSpring(value, { stiffness: 70, damping: 18 });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(v));
    return unsub;
  }, [spring]);

  return <span className="tabular">{fmtCH(display, dec)}</span>;
}

/** Mixing-console fader with engraved label, live mono readout and ruler. */
export function Fader({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  format = (v) => fmtCH(v),
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {label}
        </span>
        <span className="font-mono text-sm text-ink tabular">
          {format(value)}
          <span className="ml-1 text-[10px] text-muted">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        className="fader"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--val": `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <div className="ruler mt-1.5" aria-hidden />
    </div>
  );
}

/** Section header: green rule, expanded title, readable subline.
 *  `index` is kept in the API for compatibility but no longer rendered —
 *  section numbers were decoration, not navigation. */
export function SectionHeader({
  index: _index,
  title,
  claim,
  children,
}: {
  index?: string;
  title: string;
  claim: string;
  children?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="border-t border-line pt-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <h2 className="stretch-expand text-3xl font-black uppercase leading-[0.95] tracking-tight text-ink sm:text-4xl">
            {title}
          </h2>
          <p className="mt-2 text-sm text-muted">{claim}</p>
        </div>
        {children}
      </div>
    </motion.div>
  );
}

/** Status tag — a clean bordered chip (was a rotated rubber stamp). */
export function Stamp({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`stamp inline-block font-mono text-[11px] font-bold ${className}`}>
      {children}
    </span>
  );
}

/** Tiny segmented control used for filters & profiles. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-px border border-line bg-line">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className={`relative px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors duration-200 sm:px-4 ${
              active
                ? "bg-signal text-nacht"
                : "bg-panel text-muted hover:bg-panel2 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
