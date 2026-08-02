import type { Listing, Segment } from "../data/evData";
import { photoUrl } from "../lib/supabase";

/* ============================================================================
   CarGraphic — the image placeholder system. Every listing without photos
   gets a technical side-elevation line drawing of its segment, drawn in the
   blueprint style of the rest of the instrument (currentColor strokes, so it
   inherits panel/muted/signal from the context it sits in).
   · Small: thumbnail in Markt-Tafel rows and compare columns.
   · detailed: adds dimension marks + view label for the big dossier panel.
   ============================================================================ */

/** Side profiles per segment: front left, wheels at x=34/88, ground y≈52. */
const BODIES: Record<Segment, { body: string; glass: string }> = {
  KOMPAKT: {
    // Short two-box hatch: stubby bonnet, tall steep tailgate.
    body: "M22 45 L22 38 C22 34 24 32 28 31 L38 29 L48 20 C51 17.5 56 16.5 62 16.5 L72 16.5 C78 16.5 82 18 85 21.5 L90 28 L93 31 L96 39 L96 45 L96.5 45 L95 45 A7.5 7.5 0 0 0 81 45 L41.5 45 A7.5 7.5 0 0 0 27 45 Z",
    glass: "M50 20.5 L64 19 L64 29 L41 29 Z M67 19 L74 19 C78 19 81 20.5 83.5 23.5 L87 28.5 L67 29 Z",
  },
  LIMOUSINE: {
    // Three-box sedan: long, low, fast rear deck.
    body: "M10 45 L10 38 C10 35 12 33 16 32 L32 30 L46 20 C48.5 18 53 17 58 17 L74 17 C78.5 17 82 18.5 85 21.5 L93 29.5 L104 31.5 C108 32.5 110 34.5 110 37.5 L110 45 L95 45 A7.5 7.5 0 0 0 81 45 L41.5 45 A7.5 7.5 0 0 0 27 45 Z",
    glass: "M48 21 L62 19.5 L62 29.5 L35 30 Z M65 19.5 L74 19.5 C77.5 19.5 80.5 20.8 83 23.4 L89 29.5 L65 29.5 Z",
  },
  KOMBI: {
    // Wagon: sedan front, roofline carried all the way to a vertical rear.
    body: "M10 45 L10 38 C10 35 12 33 16 32 L32 30 L46 20 C48.5 18 53 17 58 17 L88 17 C93 17 96.5 19 98.5 23 L102 31 L104 38 L104 45 L95 45 A7.5 7.5 0 0 0 81 45 L41.5 45 A7.5 7.5 0 0 0 27 45 Z",
    glass: "M48 21 L62 19.5 L62 29.5 L35 30 Z M65 19.5 L87 19.5 C91 19.5 93.8 21 95.5 24.5 L98.5 30 L65 29.8 Z",
  },
  SUV: {
    // Tall glasshouse, high beltline, extra ground clearance.
    body: "M12 42 L12 33 C12 29.5 14 27.5 18 26.5 L32 24.5 L44 14.5 C47 12 52 11 58 11 L80 11 C86 11 90 13 93 17 L98 24.5 L106 26.5 C110 27.5 112 29.5 112 33 L112 42 L96 42 A8 8 0 0 0 80 42 L42 42 A8 8 0 0 0 26 42 Z",
    glass: "M46 15.5 L60 13.8 L60 24 L35 24.5 Z M63 13.8 L79 13.8 C83.5 13.8 87 15.3 89.5 18.5 L93.5 24 L63 24 Z",
  },
};

/** Wheel x-centers per segment (SUV sits a touch wider and higher). */
const WHEELS: Record<Segment, { xs: [number, number]; y: number; r: number }> = {
  KOMPAKT: { xs: [34, 88], y: 45, r: 7 },
  LIMOUSINE: { xs: [34, 88], y: 45, r: 7 },
  KOMBI: { xs: [34, 88], y: 45, r: 7 },
  SUV: { xs: [34, 88], y: 42, r: 8 },
};

/** Listing thumbnail: the seller's first photo when uploaded, otherwise the
 *  segment line drawing on a blueprint tile — every row gets a visual. */
export function ListingThumb({
  listing,
  className = "",
}: {
  listing: Listing;
  className?: string;
}) {
  const photo = listing.photos?.[0];
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-chip border border-line bg-surface2 ${className}`}
      aria-hidden={photo ? undefined : true}
    >
      {photo ? (
        <img
          src={photoUrl(photo)}
          alt={`${listing.brand} ${listing.model}`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <CarGraphic segment={listing.segment} className="h-full w-full p-1 text-fg3" />
      )}
    </span>
  );
}

export default function CarGraphic({
  segment,
  detailed = false,
  className = "",
}: {
  segment: Segment;
  /** Adds blueprint dimension marks + view label (big dossier placeholder). */
  detailed?: boolean;
  className?: string;
}) {
  const { body, glass } = BODIES[segment];
  const { xs, y, r } = WHEELS[segment];
  const ground = y + r + 1.5;

  return (
    <svg
      viewBox="0 0 120 60"
      className={className}
      role="img"
      aria-label={`Technische Seitenansicht — Segment ${segment}`}
    >
      {/* Ground line */}
      <line
        x1="6"
        y1={ground}
        x2="114"
        y2={ground}
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1"
        strokeDasharray="5 3"
      />
      {/* Body + glasshouse */}
      <path
        d={body}
        fill="currentColor"
        fillOpacity="0.06"
        stroke="currentColor"
        strokeOpacity="0.8"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d={glass}
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Wheels */}
      {xs.map((x) => (
        <g key={x}>
          <circle
            cx={x}
            cy={y}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.8"
            strokeWidth="1.5"
          />
          <circle cx={x} cy={y} r={r / 3} fill="currentColor" fillOpacity="0.5" />
        </g>
      ))}
      {/* Charge port — the one detail every car on this board shares */}
      <path
        d={`M${xs[1] + r + 7} ${y - 14} l-2.6 4.4 h2.2 l-2.6 4.4`}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {detailed && (
        <g stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.75">
          {/* Length dimension above the car */}
          <line x1="10" y1="6" x2="112" y2="6" />
          <line x1="10" y1="3" x2="10" y2="9" />
          <line x1="112" y1="3" x2="112" y2="9" />
          {/* Height tick at the rear */}
          <line x1="117" y1={ground} x2="117" y2="11" />
          <line x1="114.5" y1="11" x2="119.5" y2="11" />
        </g>
      )}
    </svg>
  );
}
