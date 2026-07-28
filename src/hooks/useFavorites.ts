import { useCallback, useEffect } from "react";
import { useStore } from "@nanostores/react";
import { $favorites, loadFavorites, toggleFavoriteDb } from "../stores/favorites";
import { href } from "../lib/url";
import { useSession } from "./useSession";

/** Account-backed Merkliste. Logged out, a heart click offers the login
 *  page instead of toggling — the list only exists on the account. */
export function useFavorites(): {
  favorites: string[];
  toggleFavorite: (slug: string) => void;
  canFavorite: boolean;
} {
  const { session } = useSession();
  const favorites = useStore($favorites);

  useEffect(() => {
    void loadFavorites(session?.user.id ?? null);
  }, [session]);

  const toggleFavorite = useCallback(
    (slug: string) => {
      if (!session) {
        if (window.confirm("Die Merkliste gehört zu deinem Konto. Jetzt anmelden?"))
          window.location.href = href("/konto");
        return;
      }
      void toggleFavoriteDb(slug, session.user.id);
    },
    [session],
  );

  return { favorites, toggleFavorite, canFavorite: Boolean(session) };
}
