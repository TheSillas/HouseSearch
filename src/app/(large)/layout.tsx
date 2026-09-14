import { ChromeSite } from "@/components/ChromeSite";

/**
 * Pages larges : la comparaison côte à côte a besoin de toute la largeur de
 * l'écran pour aligner jusqu'à six communes. Même habillage que les pages à
 * lire, sans la colonne de lecture.
 */
export default function LayoutLarge({ children }: { children: React.ReactNode }) {
  return <ChromeSite large>{children}</ChromeSite>;
}
