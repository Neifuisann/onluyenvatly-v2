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
 * `.dark`, `data-theme-pref` and `color-scheme` on <html>, and keeps
 * following OS changes while the preference is "system" on every page
 * (the runner has no theme toggle). Kept tiny and dependency-free; the
 * toggle's `apply` is the same logic for a chosen preference.
 */
export const themeScript = `(function(){try{var r=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)"),p;function a(q){var d=q==="dark"||(q==="system"&&m.matches);r.classList.toggle("dark",d);r.dataset.themePref=q;r.style.colorScheme=d?"dark":"light"}try{p=localStorage.getItem("${THEME_STORAGE_KEY}")}catch(e){}a(p==="light"||p==="dark"?p:"system");m.addEventListener("change",function(){if(r.dataset.themePref==="system")a("system")})}catch(e){}})()`;

export function nextThemePref(current: ThemePref): ThemePref {
  const i = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(i + 1) % THEME_ORDER.length] ?? "system";
}

export function resolveDark(pref: ThemePref, systemDark: boolean): boolean {
  return pref === "dark" || (pref === "system" && systemDark);
}
