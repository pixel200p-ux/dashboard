import { createContext, useContext } from "react";

export type CollapsibleCardGroupState = {
  open: boolean;
  toggle: () => void;
};

export const CollapsibleCardGroupContext = createContext<CollapsibleCardGroupState | null>(null);

export function useCollapsibleCardGroup() {
  return useContext(CollapsibleCardGroupContext);
}