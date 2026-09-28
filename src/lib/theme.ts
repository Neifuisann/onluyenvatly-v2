/**
 * Theme preference (07 §3.1): follows the system by default; the student can
 * force light or dark. Stored in localStorage only (no cookie, so pages stay
 * static-cacheable).
 */
export type ThemePref = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "ovl-theme";
export const THEME_ORDER: readonly ThemePref[] = ["system", "light", "dark"];

/**
 * Runs in <head> before first paint so there is no light/dark flash. Sets
 * `.dark`, `data-theme-pref` and `color-scheme` on <html>. Kept tiny and
 * dependency-free; `applyTheme` below is the same logic for runtime changes.
 */
export const themeScript = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.dataset.themePref=p;r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

export function nextThemePref(current: ThemePref): ThemePref {
  const i = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(i + 1) % THEME_ORDER.length] ?? "system";
}

export function resolveDark(pref: ThemePref, systemDark: boolean): boolean {
  return pref === "dark" || (pref === "system" && systemDark);
}
