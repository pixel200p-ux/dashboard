import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AssetType, CapitalBucket, TxType } from "@/engine/types";

export type ThemeMode = "light" | "dark";
export type DisplayCurrency = "VND" | "USD";
export type LoginThemeId = "default" | "spring" | "summer" | "autumn" | "winter";

export type CapitalPrefill = {
  id: string;
  kind: "DEPOSIT" | "WITHDRAW";
  amount: number;
  movementDate: string;
  notes: string | null;
  bucket: CapitalBucket;
};

export type TxPrefill = {
  id?: string;
  accountId?: string;
  symbol?: string;
  name?: string;
  assetType?: AssetType;
  txType?: TxType;
  tradeTplus?: boolean;
  price?: number;
  txDate?: string;
  quantity?: number | null;
  amount?: number;
  fee?: number;
  tax?: number;
  fxRate?: number | null;
  stockDivQty?: number | null;
  notes?: string | null;
  matches?: { buyTxId: string; quantity: number }[];
  matchAllOpen?: boolean;
  tplusSell?: boolean;
};
type UiState = {
  theme: ThemeMode;
  loginTheme: LoginThemeId;
  loginThemeOverrideMonth: string | null;
  currency: DisplayCurrency;
  stockFilter: "ALL" | "vps" | "ssi";
  txOpen: TxPrefill | null;
  capitalOpen: "DEPOSIT" | "WITHDRAW" | null;
  capitalEdit: CapitalPrefill | null;
  bankOpen: boolean;
  bankEditId: string | null;
  notifyOpen: boolean;
  setTheme: (t: ThemeMode) => void;
  setLoginTheme: (t: LoginThemeId) => void;
  syncLoginTheme: () => void;
  toggleTheme: () => void;
  toggleCurrency: () => void;
  setStockFilter: (f: UiState["stockFilter"]) => void;
  openTx: (p?: TxPrefill) => void;
  closeTx: () => void;
  openCapital: (k: "DEPOSIT" | "WITHDRAW") => void;
  openCapitalEdit: (row: CapitalPrefill) => void;
  closeCapital: () => void;
  openBank: (id?: string) => void;
  closeBank: () => void;
  setNotifyOpen: (v: boolean) => void;
  toggleNotify: () => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: "light",
      loginTheme: "default",
      loginThemeOverrideMonth: null,
      currency: "VND",
      stockFilter: "ALL",
      txOpen: null,
      capitalOpen: null,
      capitalEdit: null,
      bankOpen: false,
      bankEditId: null,
      notifyOpen: false,
      setTheme: (theme) => set({ theme }),
      setLoginTheme: (loginTheme) => {
        const now = new Date();
        set({
          loginTheme,
          loginThemeOverrideMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        });
      },
      syncLoginTheme: () => {
        const { loginThemeOverrideMonth } = get();
        const now = new Date();
        const month = now.getMonth() + 1;
        const monthKey = `${now.getFullYear()}-${String(month).padStart(2, "0")}`;
        if (loginThemeOverrideMonth === monthKey) return;
        const loginTheme = month <= 2 || month === 12 ? "winter" : month <= 5 ? "spring" : month <= 8 ? "summer" : "autumn";
        set({ loginTheme, loginThemeOverrideMonth: null });
      },
      toggleTheme: () => set({ theme: get().theme === "light" ? "dark" : "light" }),
      toggleCurrency: () => set({ currency: get().currency === "VND" ? "USD" : "VND" }),
      setStockFilter: (stockFilter) => set({ stockFilter }),
      openTx: (p) => set({ txOpen: p ?? {} }),
      closeTx: () => set({ txOpen: null }),
      openCapital: (capitalOpen) => set({ capitalOpen, capitalEdit: null }),
      openCapitalEdit: (capitalEdit) => set({ capitalEdit, capitalOpen: capitalEdit.kind }),
      closeCapital: () => set({ capitalOpen: null, capitalEdit: null }),
      openBank: (id) =>
        set({
          bankOpen: true,
          bankEditId: typeof id === "string" && id.length > 0 ? id : null,
        }),
      closeBank: () => set({ bankOpen: false, bankEditId: null }),
      setNotifyOpen: (notifyOpen) => set({ notifyOpen }),
      toggleNotify: () => set({ notifyOpen: !get().notifyOpen }),
    }),
    {
      name: "pm-ui",
      partialize: (s) => ({
        theme: s.theme,
        loginTheme: s.loginTheme,
        loginThemeOverrideMonth: s.loginThemeOverrideMonth,
        currency: s.currency,
        stockFilter: s.stockFilter,
      }),
    },
  ),
);
