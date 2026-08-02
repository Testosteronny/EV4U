import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { Badge, Button, Field, Segmented } from "./ui";
import { useCockpit } from "../hooks/useCockpit";
import type { Profile } from "../hooks/useProfile";
import { patchCockpit } from "../stores/cockpit";
import { FUELS, type FuelType } from "../utils/costModel";
import { resolveZip } from "../utils/swiss";

/* ============================================================================
   Verkäuferprofil — PRIVAT bleibt minimal, GARAGE öffnet die Geschäftsfelder
   (Firma, UID, Website). Gespeichert wird in die eigene profiles-Zeile.
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
    // Neue Heim-PLZ gilt sofort, sonst überschreibt die alte lokale Fixierung
    // sie beim nächsten Besuch wieder.
    if (plz && plz !== (profile.plz ?? "")) {
      const hit = resolveZip(plz);
      if (hit) setGemeinde(hit);
    }
    if (consValid) patchCockpit({ fuel, ice: consNum });
  };

  const touched = () => setSaved(false);

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h2 font-semibold text-fg">Verkäuferprofil</h2>
        <div className="flex items-center gap-2">
          {profile.verified && (
            <Badge tone="positive">
              <BadgeCheck size={13} /> Verifiziert
            </Badge>
          )}
          {saved && !dirty && <Badge tone="positive">Gespeichert</Badge>}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-small font-medium text-fg2">Kontotyp</span>
          <Segmented
            options={[
              { key: "PRIVAT" as const, label: "Privat" },
              { key: "GARAGE" as const, label: "Garage" },
            ]}
            value={type}
            onChange={(t) => {
              setType(t);
              touched();
            }}
          />
        </div>
        <Field label={type === "GARAGE" ? "Firmenname" : "Anzeigename"}>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              touched();
            }}
            maxLength={80}
            className="field"
          />
        </Field>
        <Field label="Heim-PLZ" hint="Wird als dein Standort für die Kostenrechnung übernommen.">
          <input
            value={plz}
            onChange={(e) => {
              setPlz(e.target.value.replace(/\D/g, "").slice(0, 4));
              touched();
            }}
            placeholder="4617"
            inputMode="numeric"
            className="field tabular"
          />
        </Field>
        {type === "GARAGE" && (
          <>
            <Field label="UID" hint="Prüfung über Zefix erfolgt manuell durch EV4U.">
              <input
                value={uid}
                onChange={(e) => {
                  setUid(e.target.value);
                  touched();
                }}
                placeholder="CHE-123.456.789"
                maxLength={20}
                className="field"
              />
            </Field>
            <Field label="Website">
              <input
                value={website}
                onChange={(e) => {
                  setWebsite(e.target.value);
                  touched();
                }}
                placeholder="https://…"
                maxLength={120}
                className="field"
              />
            </Field>
          </>
        )}
      </div>

      {/* Heutiges Auto — Basis jeder Vergleichsrechnung */}
      <div className="mt-6 border-t border-line pt-5">
        <h3 className="text-h3 font-semibold text-fg">Mein heutiges Auto</h3>
        <p className="mt-1 text-body text-fg2">
          Basis für jede Vergleichsrechnung. Lässt sich auch jederzeit oben in
          der Leiste «Deine Werte» ändern.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Segmented
            options={(Object.keys(FUELS) as FuelType[]).map((f) => ({
              key: f,
              label: FUELS[f].label,
            }))}
            value={fuel}
            onChange={(f) => {
              setFuel(f);
              setCons(String(FUELS[f].defaultCons));
              touched();
            }}
          />
          <div className="w-40">
            <Field label={`Verbrauch (${FUELS[fuel].unit})`}>
              <input
                value={cons}
                onChange={(e) => {
                  setCons(e.target.value.replace(/[^0-9.,]/g, ""));
                  touched();
                }}
                inputMode="decimal"
                className={`field tabular ${consValid ? "" : "border-caution"}`}
              />
            </Field>
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-small text-caution">{error}</p>}

      <div className="mt-6 flex justify-end border-t border-line pt-4">
        <Button
          onClick={() => void save()}
          disabled={!dirty || name.trim() === "" || !consValid}
          variant="primary"
        >
          Speichern
        </Button>
      </div>
    </div>
  );
}
