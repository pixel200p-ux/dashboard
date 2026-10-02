import { create } from "zustand";
import { persist } from "zustand/middleware";

export type GeminiKeyStatus = "untested" | "active" | "inactive";

export type GeminiKey = {
  id: string;
  name: string;
  value: string;
  status: GeminiKeyStatus;
  checkedAt: number | null;
};

type PixelState = {
  keys: GeminiKey[];
  addKey: (name: string, value: string) => void;
  updateKey: (id: string, update: Partial<Pick<GeminiKey, "name" | "value" | "status" | "checkedAt">>) => void;
  removeKey: (id: string) => void;
};

export const usePixelStore = create<PixelState>()(
  persist(
    (set) => ({
      keys: [],
      addKey: (name, value) =>
        set((state) => ({
          keys: [
            ...state.keys,
            {
              id: crypto.randomUUID(),
              name,
              value,
              status: "untested",
              checkedAt: null,
            },
          ],
        })),
      updateKey: (id, update) =>
        set((state) => ({
          keys: state.keys.map((key) => (key.id === id ? { ...key, ...update } : key)),
        })),
      removeKey: (id) => set((state) => ({ keys: state.keys.filter((key) => key.id !== id) })),
    }),
    {
      name: "pixel-gemini-keys",
      partialize: (state) => ({ keys: state.keys }),
    },
  ),
);

export function maskGeminiKey(value: string): string {
  if (value.length <= 6) return `${value.slice(0, 3)}${"•".repeat(Math.max(0, value.length - 3))}`;
  return `${value.slice(0, 3)}${"•".repeat(Math.min(12, value.length - 6))}${value.slice(-3)}`;
}
