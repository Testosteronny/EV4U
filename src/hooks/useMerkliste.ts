import { useMemo } from "react";
import { useStore } from "@nanostores/react";
import {
  $merkliste,
  removeSaved,
  setSavedNote,
  toggleSaved,
  type SavedCar,
} from "../stores/merkliste";
import { useHydrated } from "./useHydrated";

/** The Merkliste for rendering: empty until hydrated (see useHydrated),
 *  then the persisted list. Works logged out; AccountSync mirrors it. */
export function useMerkliste(): {
  items: SavedCar[];
  slugs: Set<string>;
  has: (slug: string) => boolean;
  toggle: typeof toggleSaved;
  remove: typeof removeSaved;
  setNote: typeof setSavedNote;
} {
  const hydrated = useHydrated();
  const raw = useStore($merkliste);
  const items = hydrated ? raw : EMPTY;
  const slugs = useMemo(() => new Set(items.map((c) => c.slug)), [items]);
  return {
    items,
    slugs,
    has: (slug) => slugs.has(slug),
    toggle: toggleSaved,
    remove: removeSaved,
    setNote: setSavedNote,
  };
}

const EMPTY: SavedCar[] = [];
