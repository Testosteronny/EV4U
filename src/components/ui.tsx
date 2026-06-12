import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useSpring } from "framer-motion";
import { fmtCH } from "../utils/swiss";

/* ============================================================================
   Shared instrument primitives:
   · FlapText        — split-flap character scramble (SBB departure board)
   · AnimatedNumber  — spring-driven odometer for CHF / km values
   · Fader           — mixing-console range slider with ruler ticks
   · SectionHeader   — Swiss-grid section intro (index · title · claim)
   · Stamp           — rubber-stamp tag (FIXIERT / EMPFOHLEN / GEBUCHT)
   ============================================================================ */

const FLAP_CHARS = "ABCDEFGHIKLMNOPRSTUVWXYZ0123456789···";

/** Airport split-flap effect: characters cycle randomly, then settle
 *  left-to-right. Re-triggers whenever `text` or `spin` changes. */
export function FlapText({
  text,
  spin = 0,
  speed = 28,
}: {
  text: string;
  spin?: number;
  speed?: number;
}) {
  const [display, setDisplay] = useState(text);
  const seed = useRef(Math.floor(Math.random() * 997));

  useEffect(() => {
    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      // Each char settles after (index + 3) frames → left-to-right wave.
      const out = text
        .split("")
        .map((ch, i) => {
          if (ch === " " || frame > i + 3) return ch;
          return FLAP_CHARS[(seed.current + frame * 7 + i * 13) % FLAP_CHARS.length];
        })
        .join("");
      setDisplay(out);
      if (frame > text.length + 3) {
        clearInterval(id);
        setDisplay(text);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, spin, speed]);

  return <span className="flap-cell">{display}</span>;
}

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

/** Swiss-grid section header: red index, expanded title, mono claim. */
export function SectionHeader({
  index,
  title,
  claim,
  children,
}: {
  index: string;
  title: string;
  claim: string;
  children?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="border-t border-line pt-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <span className="font-mono text-xs tracking-[0.25em] text-signal">
              {index}
            </span>
            <span className="current-line w-10" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
              {claim}
            </span>
          </div>
          <h2 className="stretch-expand text-3xl font-black uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
            {title}
          </h2>
        </div>
        {children}
      </div>
    </motion.div>
  );
}

/** Rubber-stamp tag with a slap-in animation. */
export function Stamp({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 1.6, rotate: 4 }}
      animate={{ opacity: 1, scale: 1, rotate: -3 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={`stamp inline-block font-mono text-[11px] font-bold ${className}`}
    >
      {children}
    </motion.span>
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
            className={`relative px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors duration-200 sm:px-4 ${
              active
                ? "bg-signal text-white"
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
