export type SpaceTab =
  "home" | "budget" | "months" | "decisions" | "reviews" | "settings";
export const sections = [
  "Your details",
  "Shared costs",
  "Compare splits",
  "Confirm plan",
];
export function readNavigation(url: URL) {
  const requested = url.searchParams.get("tab");
  const tab: SpaceTab = [
    "home",
    "budget",
    "months",
    "decisions",
    "reviews",
    "settings",
  ].includes(requested || "")
    ? (requested as SpaceTab)
    : url.pathname.startsWith("/plan/")
      ? "budget"
      : "home";
  const raw = url.searchParams.get("section"),
    section = raw !== null && /^[0-3]$/.test(raw) ? Number(raw) : null;
  return { tab, section, decision: url.searchParams.get("decision") };
}
export function budgetLink(id: string, key: string, section?: number) {
  return `/space/${id}?tab=budget${section === undefined ? "" : `&section=${Math.min(3, Math.max(0, section))}`}#key=${key}`;
}
