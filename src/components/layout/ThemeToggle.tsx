import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/* ============================================================================
   Hell / Dunkel. Hell ist der Default, die Systempräferenz der Startwert,
   eine ausdrückliche Wahl gewinnt (localStorage `ev4u.theme`). Das Skript im
   <head> von Base.astro setzt die Klasse vor dem ersten Paint.
   ============================================================================ */

export function useTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    // The theme-color metas follow prefers-color-scheme and know nothing of
    // an explicit choice — replace them so the browser UI follows the page.
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => m.remove());
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = next ? "#0B0D0C" : "#FFFFFF";
    document.head.appendChild(meta);
    try {
      localStorage.setItem("ev4u.theme", next ? "dark" : "light");
    } catch {
      /* private mode — the choice holds for this page only */
    }
  };

  return [dark, toggle];
}

/** Text button for the footer and the menus. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, toggle] = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-2 transition-colors ${className}`}
      aria-label={dark ? "Hellen Modus einschalten" : "Dunklen Modus einschalten"}
    >
      {dark ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
      {dark ? "Heller Modus" : "Dunkler Modus"}
    </button>
  );
}
