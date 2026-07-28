import { useEffect, useState } from "react";
import { BadgeCheck, Building2, Car, User } from "lucide-react";
import { Segmented, Stamp } from "./ui";
import { useCockpit } from "../hooks/useCockpit";
import type { Profile } from "../hooks/useProfile";
import { patchCockpit } from "../stores/cockpit";
import { FUELS, type FuelType } from "../utils/costModel";
import { resolveZip } from "../utils/swiss";

/* ============================================================================
   ProfilePanel — who is selling here? PRIVAT keeps it minimal (display
   name); GARAGE opens the business fields (Firma, UID, Website) that later
   feed the public garage profile and Zefix verification. Saved to the
   user's own profiles row (RLS-scoped).
   ============================================================================ */

export default function ProfilePanel({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (fields: Partial<Omit<Profile, "id" | "verified">>) => Promise<string | null>;
}) {
  const { setGemeinde } = useCockpit();
  const [type, setType] = useState<Profile["type"]>(profile.type);
  const [name, setName] = useState(profile.name);
  const [plz, setPlz] = useState(profile.plz ?? "");
  const [uid, setUid] = useState(profile.company_uid ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [fuel, setFuel] = useState<FuelType>(profile.car_fuel ?? "BENZIN");
  const [cons, setCons] = useState(
    String(profile.car_consumption ?? FUELS[profile.car_fuel ?? "BENZIN"].defaultCons),
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh row after reload/save → sync the inputs.
  useEffect(() => {
    setType(profile.type);
    setName(profile.name);
    setPlz(profile.plz ?? "");
    setUid(profile.company_uid ?? "");
    setWebsite(profile.website ?? "");
    setFuel(profile.car_fuel ?? "BENZIN");
    setCons(
      String(profile.car_consumption ?? FUELS[profile.car_fuel ?? "BENZIN"].defaultCons),
    );
  }, [profile]);

  const consNum = Number(cons.replace(",", "."));
  const consValid = Number.isFinite(consNum) && consNum > 0 && consNum < 50;

  const dirty =
    type !== profile.type ||
    name !== profile.name ||
    plz !== (profile.plz ?? "") ||
    uid !== (profile.company_uid ?? "") ||
    website !== (profile.website ?? "") ||
    fuel !== (profile.car_fuel ?? "BENZIN") ||
    consNum !== Number(profile.car_consumption ?? FUELS[fuel].defaultCons);

  const save = async () => {
    setError(null);
    const err = await onSave({
      type,
      name,
      plz: plz || null,
      company_uid: type === "GARAGE" ? uid || null : null,
      website: type === "GARAGE" ? website || null : null,
      car_fuel: fuel,
      car_consumption: consValid ? consNum : null,
    });
    if (err) {
      setError(err);
      return;
    }
    setSaved(true);
    // A new home PLZ becomes the live fix immediately — otherwise the stale
    // local location would overwrite it again on the next visit.
    if (plz && plz !== (profile.plz ?? "")) {
      const hit = resolveZip(plz);
      if (hit) setGemeinde(hit);
    }
    // Same for the comparison car: every engine recalculates right away.
    if (consValid) patchCockpit({ fuel, ice: consNum });
  };

  return (
    <div className="panel bg-blueprint p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
          {type === "GARAGE" ? <Building2 size={13} className="text-signal" /> : <User size={13} className="text-signal" />}
          Verkäuferprofil
        </span>
        <div className="flex items-center gap-3">
          {profile.verified && (
            <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-lume">
              <BadgeCheck size={12} /> Verifiziert
            </span>
          )}
          {saved && !dirty && <Stamp className="!border-lume !text-lume">Gespeichert</Stamp>}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
            Kontotyp
          </span>
          <Segmented
            options={[
              { key: "PRIVAT" as const, label: "PRIVAT" },
              { key: "GARAGE" as const, label: "GARAGE" },
            ]}
            value={type}
            onChange={(t) => {
              setType(t);
              setSaved(false);
            }}
          />
        </div>
        <label className="block min-w-[180px] flex-1">
          <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
            {type === "GARAGE" ? "Firmenname" : "Anzeigename"}
          </span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            maxLength={80}
            className="w-full border border-line bg-nacht px-3 py-2.5 font-mono text-sm text-ink focus:border-signal focus:outline-none"
          />
        </label>
        <label className="block w-28">
          <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
            Heim-PLZ
          </span>
          <input
            value={plz}
            onChange={(e) => {
              setPlz(e.target.value.replace(/\D/g, "").slice(0, 4));
              setSaved(false);
            }}
            placeholder="4617"
            inputMode="numeric"
            className="w-full border border-line bg-nacht px-3 py-2.5 font-mono text-sm text-ink placeholder:text-muted/50 focus:border-signal focus:outline-none"
          />
        </label>
        {type === "GARAGE" && (
          <>
            <label className="block min-w-[160px]">
              <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
                UID (CHE-…)
              </span>
              <input
                value={uid}
                onChange={(e) => {
                  setUid(e.target.value);
                  setSaved(false);
                }}
                placeholder="CHE-123.456.789"
                maxLength={20}
                className="w-full border border-line bg-nacht px-3 py-2.5 font-mono text-sm text-ink placeholder:text-muted/50 focus:border-signal focus:outline-none"
              />
            </label>
            <label className="block min-w-[180px]">
              <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
                Website
              </span>
              <input
                value={website}
                onChange={(e) => {
                  setWebsite(e.target.value);
                  setSaved(false);
                }}
                placeholder="https://…"
                maxLength={120}
                className="w-full border border-line bg-nacht px-3 py-2.5 font-mono text-sm text-ink placeholder:text-muted/50 focus:border-signal focus:outline-none"
              />
            </label>
          </>
        )}
        <button
          onClick={() => void save()}
          disabled={!dirty || name.trim() === "" || !consValid}
          className="border border-signal bg-signal px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-nacht transition-colors hover:bg-signal-dim disabled:cursor-not-allowed disabled:border-line disabled:bg-panel disabled:text-muted"
        >
          Speichern
        </button>
      </div>

      {/* Current car — feeds every Rechenwerk comparison */}
      <div className="mt-5 border-t border-dashed border-line pt-4">
        <div className="mb-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-muted">
          <Car size={13} className="text-signal" /> Mein heutiges Auto — Basis
          für jede Vergleichsrechnung
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <Segmented
            options={(Object.keys(FUELS) as FuelType[]).map((f) => ({
              key: f,
              label: f,
            }))}
            value={fuel}
            onChange={(f) => {
              setFuel(f);
              setCons(String(FUELS[f].defaultCons));
              setSaved(false);
            }}
          />
          <label className="block w-40">
            <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
              Verbrauch ({FUELS[fuel].unit})
            </span>
            <input
              value={cons}
              onChange={(e) => {
                setCons(e.target.value.replace(/[^0-9.,]/g, ""));
                setSaved(false);
              }}
              inputMode="decimal"
              className={`w-full border bg-nacht px-3 py-2.5 font-mono text-sm text-ink focus:outline-none ${
                consValid ? "border-line focus:border-signal" : "border-warn"
              }`}
            />
          </label>
        </div>
      </div>

      {error && (
        <p className="mt-3 font-mono text-[10px] tracking-[0.12em] text-warn">
          {error.toUpperCase()}
        </p>
      )}
      {type === "GARAGE" && (
        <p className="mt-3 font-mono text-[9px] leading-relaxed tracking-[0.1em] text-muted/70">
          GARAGEN-KONTEN ERHALTEN DAS GARAGE-LABEL AUF JEDEM INSERAT. UID-PRÜFUNG
          (ZEFIX) & VERIFIZIERT-BADGE: MANUELL DURCH EV4U.
        </p>
      )}
    </div>
  );
}
