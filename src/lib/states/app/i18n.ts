import { atom } from "jotai/vanilla";
import { m } from "../../../paraglide/messages.js";
import { getLocale, locales } from "../../../paraglide/runtime.js";
import { atomWithAppStorage } from "./storage-utils.js";

export type AvailableLocale = (typeof locales)[number];

export type MessageParamMap = {
  [K in keyof typeof m]: Parameters<(typeof m)[K]>[0];
};

export type AvailableMessage = keyof typeof m;

// We should not translate language name itself.
// Language names are used in UI and should be consistent across locales.
// Sort alphabetically by locale code.
export const LOCALE_NAMES = {
  en: "English (en)",
  ja: "日本語 (ja)",
} as const satisfies Record<AvailableLocale, string>;

export const localeAtom = atomWithAppStorage<AvailableLocale>(
  "settings.locale",
  "user",
  getLocale(),
);

export const i18nAtom = atom((get) => {
  const locale = get(localeAtom);
  return Object.fromEntries(
    Object.entries(m).map(([key, value]) => [
      key,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (params?: any, options?: { locale?: AvailableLocale }) =>
        value(params, { ...options, locale }),
    ]),
  ) as typeof m;
});
