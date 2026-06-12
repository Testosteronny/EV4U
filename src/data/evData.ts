/* ============================================================================
   EV4U is a classifieds platform: private second-hand sellers + garages.
   The Markt-Tafel shows open Inserate (listings); only AKTIV listings are
   selectable in the Rechenwerk simulation. Specs follow real Swiss-market
   configurations; production app: listings API / database.
   ============================================================================ */

export type Segment = "KOMPAKT" | "LIMOUSINE" | "KOMBI" | "SUV";

export type ListingStatus = "AKTIV" | "RESERVIERT";

export type Listing = {
  id: string;
  brand: string;
  model: string;
  segment: Segment;
  /** First registration year */
  year: number;
  /** Mileage, km */
  km: number;
  /** Asking price, CHF */
  price: number;
  /** Swiss list price when new, CHF — drives the Neupreis-Vergleich. */
  priceNew?: number;
  /** WLTP range, km */
  range: number;
  /** Real-mix consumption, kWh / 100 km */
  consumption: number;
  /** DC charge 10→80 %, minutes */
  chargeMin: number;
  /** Peak DC power, kW */
  dcKw: number;
  /** Usable battery, kWh */
  battery: number;
  /** Curb weight, kg — drives the cantonal tax model. Filled by the
   *  vehicle-model API once selected (see README); fallback REF_WEIGHT_KG. */
  weightKg?: number;
  /** Battery state of health, % — measured, not claimed */
  soh: number;
  /** Bidirectional (V2H/V2L/V2G) capable */
  bidi: boolean;
  /** Number of seats */
  seats: number;
  /** Days since the ad was posted — drives "NEU" tags and the home teaser */
  postedDays: number;
  seller: string;
  sellerType: "PRIVAT" | "GARAGE";
  ort: string;
  status: ListingStatus;
  /** One signature fact for the dossier drawer */
  note: string;
  /** Database id (uuid) — set when loaded live; used by messaging. */
  uid?: string;
  /** Owning profile (uuid) — null/undefined for platform-seeded listings,
   *  which are therefore not messageable. */
  owner?: string | null;
  /** Photo paths in the listing-photos bucket. */
  photos?: string[];
};

export const LISTINGS: Listing[] = [
  {
    id: "dacia-spring",
    brand: "DACIA",
    model: "SPRING EXTREME",
    segment: "KOMPAKT",
    year: 2023,
    km: 31000,
    price: 9900,
    range: 225,
    consumption: 13.9,
    chargeMin: 45,
    dcKw: 30,
    battery: 26.8,
    soh: 91,
    bidi: false,
    seats: 4,
    postedDays: 6,
    weightKg: 1045,
    seller: "R. Steiner",
    sellerType: "PRIVAT",
    ort: "4600 Olten",
    status: "AKTIV",
    note: "Günstigster Einstieg auf der Tafel — ideal als Zweitwagen, frisch ab MFK.",
  },
  {
    id: "renault-5",
    brand: "RENAULT",
    model: "5 E-TECH 52",
    segment: "KOMPAKT",
    year: 2025,
    km: 9500,
    price: 22900,
    range: 410,
    consumption: 15.1,
    chargeMin: 30,
    dcKw: 100,
    battery: 52,
    soh: 99,
    bidi: true,
    seats: 5,
    postedDays: 1,
    weightKg: 1450,
    seller: "Garage Brunner AG",
    sellerType: "GARAGE",
    ort: "4600 Olten",
    status: "AKTIV",
    note: "Echtes V2G ab Werk — kann Strom zurück ins Netz speisen. Vorführwagen, Werksgarantie bis 2030.",
  },
  {
    id: "tesla-m3",
    brand: "TESLA",
    model: "MODEL 3 RWD",
    segment: "LIMOUSINE",
    year: 2024,
    km: 28000,
    price: 31900,
    range: 513,
    consumption: 13.2,
    chargeMin: 27,
    dcKw: 250,
    battery: 60,
    soh: 97,
    bidi: false,
    seats: 5,
    postedDays: 3,
    weightKg: 1765,
    seller: "M. Odermatt",
    sellerType: "PRIVAT",
    ort: "8400 Winterthur",
    status: "AKTIV",
    note: "Highland-Facelift, Effizienz-Referenz der Tafel. Voller Supercharger-Zugang.",
  },
  {
    id: "byd-seal",
    brand: "BYD",
    model: "SEAL EXCELLENCE",
    segment: "LIMOUSINE",
    year: 2024,
    km: 22000,
    price: 33900,
    range: 520,
    consumption: 16.1,
    chargeMin: 37,
    dcKw: 150,
    battery: 82,
    soh: 98,
    bidi: true,
    seats: 5,
    postedDays: 9,
    weightKg: 2055,
    seller: "EV-Center Zürich",
    sellerType: "GARAGE",
    ort: "8050 Zürich",
    status: "AKTIV",
    note: "Cell-to-Body: die Blade-Batterie ist tragendes Karosserieteil. Garantie-Restlaufzeit 5 Jahre.",
  },
  {
    id: "hyundai-i6",
    brand: "HYUNDAI",
    model: "IONIQ 6 77",
    segment: "LIMOUSINE",
    year: 2023,
    km: 41000,
    price: 31500,
    range: 614,
    consumption: 14.3,
    chargeMin: 18,
    dcKw: 233,
    battery: 77,
    soh: 95,
    bidi: true,
    seats: 5,
    postedDays: 12,
    weightKg: 1985,
    seller: "C. Aebischer",
    sellerType: "PRIVAT",
    ort: "3011 Bern",
    status: "AKTIV",
    note: "800-V-Architektur: 18 Minuten von 10 auf 80 %. Erstbesitz, Anhängerkupplung.",
  },
  {
    id: "porsche-taycan",
    brand: "PORSCHE",
    model: "TAYCAN",
    segment: "LIMOUSINE",
    year: 2022,
    km: 47000,
    price: 69900,
    range: 510,
    consumption: 16.7,
    chargeMin: 18,
    dcKw: 270,
    battery: 93,
    soh: 93,
    bidi: false,
    seats: 4,
    postedDays: 15,
    weightKg: 2295,
    seller: "Sportwagen Keller GmbH",
    sellerType: "GARAGE",
    ort: "6300 Zug",
    status: "AKTIV",
    note: "Performance Battery Plus, Service-Historie lückenlos, neue MFK.",
  },
  {
    id: "vw-id7",
    brand: "VW",
    model: "ID.7 TOURER PRO S",
    segment: "KOMBI",
    year: 2024,
    km: 19000,
    price: 42900,
    range: 685,
    consumption: 14.5,
    chargeMin: 26,
    dcKw: 200,
    battery: 86,
    soh: 98,
    bidi: false,
    seats: 5,
    postedDays: 2,
    weightKg: 2180,
    seller: "Auto Wyss AG",
    sellerType: "GARAGE",
    ort: "4500 Solothurn",
    status: "AKTIV",
    note: "Grösste WLTP-Reichweite der Tafel — Zürich–Milano ohne Stopp. Ex-Geschäftswagen.",
  },
  {
    id: "nio-et5t",
    brand: "NIO",
    model: "ET5 TOURING",
    segment: "KOMBI",
    year: 2023,
    km: 36000,
    price: 33900,
    range: 560,
    consumption: 17.2,
    chargeMin: 20,
    dcKw: 180,
    battery: 100,
    soh: 96,
    bidi: false,
    seats: 5,
    postedDays: 20,
    weightKg: 2145,
    seller: "L. Bernasconi",
    sellerType: "PRIVAT",
    ort: "6900 Lugano",
    status: "RESERVIERT",
    note: "Battery-Swap-fähig: volle Batterie in 5 Minuten an CH-Swap-Stationen.",
  },
  {
    id: "bmw-i5t",
    brand: "BMW",
    model: "I5 TOURING",
    segment: "KOMBI",
    year: 2024,
    km: 21000,
    price: 57900,
    range: 560,
    consumption: 17.9,
    chargeMin: 30,
    dcKw: 205,
    battery: 81,
    soh: 98,
    bidi: false,
    seats: 5,
    postedDays: 4,
    weightKg: 2265,
    seller: "Premium Motors Basel",
    sellerType: "GARAGE",
    ort: "4051 Basel",
    status: "AKTIV",
    note: "Adaptive Rekuperation liest Topografie & Verkehr voraus. 8-fach bereift.",
  },
  {
    id: "skoda-enyaq",
    brand: "ŠKODA",
    model: "ENYAQ 85",
    segment: "SUV",
    year: 2024,
    km: 24000,
    price: 32900,
    range: 561,
    consumption: 15.0,
    chargeMin: 28,
    dcKw: 175,
    battery: 77,
    soh: 97,
    bidi: false,
    seats: 5,
    postedDays: 7,
    weightKg: 2020,
    seller: "T. Gantenbein",
    sellerType: "PRIVAT",
    ort: "9000 St. Gallen",
    status: "AKTIV",
    note: "Preis-Leistungs-Referenz im Familiensegment, AHK bis 1'200 kg.",
  },
  {
    id: "kia-ev6",
    brand: "KIA",
    model: "EV6 77 AWD",
    segment: "SUV",
    year: 2022,
    km: 58000,
    price: 26900,
    range: 528,
    consumption: 16.5,
    chargeMin: 18,
    dcKw: 240,
    battery: 77,
    soh: 92,
    bidi: true,
    seats: 5,
    postedDays: 11,
    weightKg: 2090,
    seller: "S. Favre",
    sellerType: "PRIVAT",
    ort: "1003 Lausanne",
    status: "AKTIV",
    note: "V2L-Steckdose ab Werk: 3.6 kW für Werkzeug, Camping oder Notstrom.",
  },
  {
    id: "audi-q6",
    brand: "AUDI",
    model: "Q6 E-TRON",
    segment: "SUV",
    year: 2025,
    km: 11000,
    price: 62900,
    range: 625,
    consumption: 16.6,
    chargeMin: 21,
    dcKw: 270,
    battery: 95,
    soh: 99,
    bidi: false,
    seats: 5,
    postedDays: 18,
    weightKg: 2350,
    seller: "Audi Zentrum Chur",
    sellerType: "GARAGE",
    ort: "7000 Chur",
    status: "RESERVIERT",
    note: "PPE-Plattform mit 800 V — Bank-Laden: zwei 400-V-Hälften parallel.",
  },
];

export const ACTIVE_LISTINGS = LISTINGS.filter((l) => l.status === "AKTIV");

export const SEGMENTS: ("ALLE" | Segment)[] = [
  "ALLE",
  "KOMPAKT",
  "LIMOUSINE",
  "KOMBI",
  "SUV",
];

export type SortKey = "price" | "km" | "range";

export const SORTS: { key: SortKey; label: string; dir: 1 | -1 }[] = [
  { key: "price", label: "↑ PREIS", dir: 1 },
  { key: "km", label: "↑ KM", dir: 1 },
  { key: "range", label: "↓ REICHWEITE", dir: -1 },
];

/* ============================================================================
   Charging-card combos — real Swiss offers, prices as published by the
   providers (Stand 06/2026):
   · TCS eCharge: no base fee, price per station (typ. 0.55–0.60 DC in CH),
     −5 % with TCS Mastercard. Swisscharge network: 15'000+ points.
   · MOVE flex: CHF 19.90/month incl. 45 kWh, partner rate 0.59 CHF/kWh at
     GOFAST & Fastned HPC.
   · IONITY Passport: CHF 11.99/month, 0.46 CHF/kWh at IONITY HPC in CH.
   ============================================================================ */
export const CARDS_AS_OF = "06/2026";

export type CardCombo = {
  id: string;
  primary: string;
  secondary: string;
  monthly: number;
  perKwh: number;
  /** kWh per YEAR included in the subscription (MOVE flex: 45 × 12). */
  inclKwh: number;
  network: string;
};

export const CARD_COMBOS: CardCombo[] = [
  {
    id: "tcs-swisscharge",
    primary: "TCS eCharge",
    secondary: "Swisscharge",
    monthly: 0,
    perKwh: 0.57,
    inclKwh: 0,
    network: "15'000+ Ladepunkte CH · Preis je Säule",
  },
  {
    id: "move-flex-gofast",
    primary: "MOVE flex",
    secondary: "GOFAST/Fastned",
    monthly: 19.9,
    perKwh: 0.59,
    inclKwh: 540,
    network: "45 kWh/Mt. inklusive · Partner-HPC",
  },
  {
    id: "ionity-supercharger",
    primary: "IONITY Passport",
    secondary: "Supercharger-App",
    monthly: 11.99,
    perKwh: 0.46,
    inclKwh: 0,
    network: "350-kW-HPC CH/EU · Langstrecke",
  },
];

/* ============================================================================
   Gabriel — the one advisor. Casual, honest, drives electric himself.
   ============================================================================ */
export const GABRIEL = {
  name: "Gabriel",
  initials: "G",
  intro:
    "Hoi! Ich bin Gabriel. Ich fahre selbst elektrisch — und sage dir auch, wenn ein Auto nichts für dich ist.",
  slots: ["HEUTE 14:15", "HEUTE 16:45", "MORGEN 09:30", "MORGEN 13:30"],
};
