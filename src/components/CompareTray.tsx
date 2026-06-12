import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { GitCompareArrows, X } from "lucide-react";
import { useCockpit } from "../context/CockpitContext";
import { useListings } from "../context/ListingsContext";

/* ============================================================================
   CompareTray — fixed bottom bar that appears once listings are picked for
   comparison. Hidden on /vergleich itself (you're already there).
   ============================================================================ */

export default function CompareTray() {
  const { compareIds, toggleCompare, clearCompare } = useCockpit();
  const { listings } = useListings();
  const { pathname } = useLocation();
  const visible = compareIds.length > 0 && pathname !== "/vergleich";

  const items = compareIds
    .map((id) => listings.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed inset-x-0 bottom-4 z-40 px-4"
        >
          <div className="panel mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 border-signal/50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <GitCompareArrows size={14} className="text-signal" />
              {items.map((l) => (
                <button
                  key={l.id}
                  onClick={() => toggleCompare(l.id)}
                  title="Entfernen"
                  className="group flex items-center gap-1.5 border border-line bg-nacht px-2.5 py-1.5 font-mono text-[10px] tracking-[0.1em] text-ink transition-colors hover:border-signal"
                >
                  {l.brand} {l.model.split(" ")[0]}
                  <X size={10} className="text-muted group-hover:text-signal" />
                </button>
              ))}
              <span className="font-mono text-[9px] tracking-[0.15em] text-muted">
                {compareIds.length}/3
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearCompare}
                className="font-mono text-[9px] tracking-[0.15em] text-muted hover:text-ink"
              >
                LEEREN
              </button>
              <Link
                to="/vergleich"
                className={`border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                  compareIds.length >= 2
                    ? "border-signal bg-signal text-white hover:bg-signal-dim"
                    : "pointer-events-none border-line text-muted"
                }`}
              >
                Vergleichen →
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
