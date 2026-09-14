import type { Position } from "@/lib/scoring";

/**
 * Barre de position relative.
 *
 * Elle ne note pas : sa longueur est le rang de la commune parmi celles
 * comparées. Le trait central rappelle la médiane, pour qu'une barre courte se
 * lise « en dessous de la moitié » et non « mauvaise note ».
 *
 * Elle traduit le rang milieu, où les ex-æquo comptent pour une demi-victoire ;
 * la phrase qui l'accompagne, elle, repose sur des décomptes réels de communes.
 * Les positions ne dépendent pas des curseurs : la largeur est fixée une fois et
 * ne subit aucune transition, ce qui évite tout recalcul de mise en page pendant
 * qu'un curseur bouge.
 */
export function BarrePosition({
  position,
  hauteur = "fine",
  libelleAccessible,
  decoratif = false,
}: {
  position: Position | null;
  hauteur?: "fine" | "epaisse";
  libelleAccessible?: string;
  /** Vrai quand une phrase voisine dit déjà la même chose en toutes lettres. */
  decoratif?: boolean;
}) {
  const epaisseur = hauteur === "epaisse" ? "h-2" : "h-[3px]";

  if (!position) {
    return <div className={`w-full rounded-full bg-doux ${epaisseur}`} aria-hidden="true" />;
  }

  const pourcent = Math.round(position.fraction * 100);
  const etiquette = decoratif || !libelleAccessible
    ? { "aria-hidden": true as const }
    : { role: "img", "aria-label": libelleAccessible };

  return (
    <span
      className={`relative block w-full overflow-hidden rounded-full bg-doux ${epaisseur}`}
      {...etiquette}
    >
      <span
        className="block h-full rounded-full bg-accent"
        style={{ width: `${Math.max(pourcent, 2)}%` }}
      />
      <span className="absolute inset-y-0 left-1/2 w-px bg-trait-fort" aria-hidden="true" />
    </span>
  );
}
