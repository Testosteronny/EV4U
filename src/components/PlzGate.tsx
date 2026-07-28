import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Crosshair, MapPin, X } from "lucide-react";
import { Stamp } from "./ui";
import { useCockpit } from "../hooks/useCockpit";
import { useProfile } from "../hooks/useProfile";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";
import { href } from "../lib/url";
import { patchCockpit } from "../stores/cockpit";
import { CH_AVG_TARIFF, TARIFF_META, fmtCH, resolveZip } from "../utils/swiss";

/* ============================================================================
   PlzGate — the account⇄cockpit sync, mounted on every page:
   · First visit without a fix → a Standort popup asks for the PLZ right
     away (dismissable; skipped on /konto so it never blocks the login).
   · Logged in → home PLZ and the current-car setting (fuel + consumption)
     are adopted from the profile, and every local change — popup, hero,
     engine faders — is saved back to the account.
   Closing never depends on an exit animation — a stuck invisible overlay
   would swallow every tap (see MobileMenu).
   ============================================================================ */

const DISMISS_KEY = "ev4u.plz.dismissed";

export default function PlzGate() {
  const { session, ready } = useSession();
  const { profile, loaded } = useProfile(session?.user.id);
  const { gemeinde, setGemeinde, currentFuel, currentCons, hydrated } = useCockpit();
  const [open, setOpen] = useState(false);
  const [zip, setZip] = useState("");
  const asked = useRef(false);
  const adoptedCar = useRef(false);

  const hit = zip.length === 4 ? resolveZip(zip) : null;
  const invalid = zip.length === 4 && !hit;

  // Decide once per visit: adopt the home PLZ, or ask for one. Waits for the
  // cockpit hydration — a persisted PLZ must never be asked for again.
  useEffect(() => {
    if (!ready || !hydrated || gemeinde) return;
    if (session && !loaded) return; // wait for the profile (may carry the PLZ)
    if (profile?.plz) {
      const home = resolveZip(profile.plz);
      if (home) {
        setGemeinde(home);
        return;
      }
    }
    if (asked.current) return;
    asked.current = true;
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* storage blocked — just ask */
    }
    if (window.location.pathname.replace(/\/$/, "") === href("/konto")) return;
    setOpen(true);
  }, [ready, hydrated, session, loaded, profile, gemeinde, setGemeinde]);

  // Save every fix as the account's home PLZ (profiles.plz, own row via RLS).
  useEffect(() => {
    if (!supabase || !session || !loaded || !profile || !gemeinde) return;
    if (profile.plz !== gemeinde.zip) {
      void supabase
        .from("profiles")
        .update({ plz: gemeinde.zip })
        .eq("id", session.user.id);
    }
  }, [gemeinde, session, loaded, profile]);

  // Adopt the account's current-car setting once per visit.
  useEffect(() => {
    if (!loaded || !profile || adoptedCar.current) return;
    adoptedCar.current = true;
    if (profile.car_fuel && profile.car_consumption) {
      patchCockpit({ fuel: profile.car_fuel, ice: Number(profile.car_consumption) });
    }
  }, [loaded, profile]);

  // Write local current-car changes (engine faders, profile panel) back to
  // the account — debounced, faders fire continuously while dragging.
  useEffect(() => {
    if (!supabase || !session || !loaded || !profile) return;
    if (
      profile.car_fuel === currentFuel &&
      Number(profile.car_consumption) === currentCons
    )
      return;
    const t = setTimeout(() => {
      void supabase
        ?.from("profiles")
        .update({ car_fuel: currentFuel, car_consumption: currentCons })
        .eq("id", session.user.id);
    }, 800);
    return () => clearTimeout(t);
  }, [currentFuel, currentCons, session, loaded, profile]);

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* fine — asks again next page */
    }
    setOpen(false);
  };

  const apply = () => {
    if (!hit) return;
    setGemeinde(hit); // write-back effect persists it for logged-in users
    setOpen(false);
  };

  // Escape dismisses; body scroll locks while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-nacht/80 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Standort fixieren"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="panel bg-blueprint relative w-full max-w-md p-6"
      >
        <span className="current-line absolute inset-x-0 top-0" aria-hidden />
        <button
          onClick={dismiss}
          aria-label="Ohne Standort weiter"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center border border-line text-muted transition-colors hover:border-signal hover:text-signal"
        >
          <X size={14} />
        </button>

        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <Crosshair size={13} className="text-signal" /> Dein Standort
        </div>
        <h2 className="stretch-wide mt-3 text-2xl font-extrabold uppercase leading-tight text-ink">
          Dein Ort, dein Strompreis.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          EV4U rechnet jedes Inserat mit dem Stromtarif deiner Gemeinde durch —
          die PLZ genügt.
        </p>

        <label className="mt-5 flex items-center gap-3 border border-line bg-nacht px-4 py-3 transition-colors focus-within:border-signal/60">
          <MapPin size={16} className="shrink-0 text-muted" strokeWidth={1.5} />
          <input
            autoFocus
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="PLZ — z. B. 4617"
            inputMode="numeric"
            className="w-full bg-transparent font-mono text-lg tracking-[0.3em] text-ink placeholder:text-sm placeholder:tracking-normal placeholder:text-muted/60 focus:outline-none"
            aria-label="Schweizer Postleitzahl"
          />
        </label>

        {invalid && (
          <p className="mt-2 text-sm text-warn">Keine Schweizer PLZ — bitte prüfen.</p>
        )}
        {hit && (
          <div className="mt-4 flex items-center justify-between gap-4 border border-signal/40 bg-signal/[0.06] px-4 py-3">
            <div>
              <div className="stretch-wide text-lg font-extrabold uppercase text-ink">
                {hit.name}
              </div>
              <div className="text-sm text-muted">
                {hit.zip} · Kanton {hit.canton} ·{" "}
                <span className="font-mono text-signal tabular">
                  {fmtCH(hit.tariff * 100, 1)} Rp./kWh
                </span>
              </div>
            </div>
            <Stamp>{hit.estimated ? "Geschätzt" : "Gefunden"}</Stamp>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            onClick={dismiss}
            className="border border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-signal hover:text-signal"
          >
            Später
          </button>
          <button
            onClick={apply}
            disabled={!hit}
            className="border border-signal bg-signal px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-nacht transition-colors hover:bg-signal-dim disabled:cursor-not-allowed disabled:border-line disabled:bg-panel disabled:text-muted"
          >
            Tarif übernehmen
          </button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-muted/80">
          {session
            ? "Wird als Heim-PLZ in deinem Konto gespeichert."
            : `Ohne PLZ rechnet EV4U mit dem Schweizer Median (${fmtCH(CH_AVG_TARIFF * 100, 1)} Rp./kWh, ElCom ${TARIFF_META.period}).`}
        </p>
      </motion.div>
    </div>
  );
}
