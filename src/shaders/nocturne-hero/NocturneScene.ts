export const NOCTURNE_VARIANTS = ["midnight"] as const;
export type NocturneVariant = (typeof NOCTURNE_VARIANTS)[number];
export const NOCTURNE_TITLES: Record<NocturneVariant, string> = {
  midnight: "Nocturne - midnight background",
};
export function buildNocturneDocument(_variant?: string): string | undefined {
  return undefined;
}
