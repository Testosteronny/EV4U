import { useCallback, useEffect } from "react";
import { useStore } from "@nanostores/react";
import { $favorites, loadFavorites, toggleFavoriteDb } from "../stores/favorites";
import { askToLogIn } from "../stores/ui";
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
        askToLogIn(
          "Die Merkliste gehört zu deinem Konto — so findest du dieses Auto auf jedem Gerät wieder.",
        );
        return;
      }
      void toggleFavoriteDb(slug, session.user.id);
    },
    [session],
  );

  return { favorites, toggleFavorite, canFavorite: Boolean(session) };
}
