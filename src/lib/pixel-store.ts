import { create } from "zustand";
import { persist } from "zustand/middleware";

export type GeminiKeyStatus = "untested" | "active" | "inactive";
export type AIKeyProvider = "gemini" | "groq" | "openrouter";
export type SearchKeyProvider = "tavily" | "jina";
export type PixelKeyProvider = AIKeyProvider | SearchKeyProvider;

export const PIXEL_KEY_PROVIDERS: { value: PixelKeyProvider; label: string }[] = [
  { value: "gemini", label: "Gemini" },
  { value: "groq", label: "Groq" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "tavily", label: "Tavily Search" },
  { value: "jina", label: "Jina Reader" },
];

export type GeminiKey = {
  id: string;
  provider?: AIKeyProvider;
  name: string;
  value: string;
  status: GeminiKeyStatus;
  checkedAt: number | null;
};

type PixelState = {
  keys: GeminiKey[];
  removeKey: (id: string) => void;
};

export const usePixelStore = create<PixelState>()(
  persist(
    (set) => ({
      keys: [],
      removeKey: (id) => set((state) => ({ keys: state.keys.filter((key) => key.id !== id) })),
    }),
    {
      name: "pixel-gemini-keys",
      partialize: (state) => ({ keys: state.keys }),
    },
  ),
);
