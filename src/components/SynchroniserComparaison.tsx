"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { decoderSlugs, lienComparaison, PARAM_COMPARAISON } from "@/lib/comparaison";
import { comparees, type CommuneReperable } from "@/lib/selection";
import { useSelection } from "@/lib/useSelection";

/**
 * Sur la page de comparaison, le bandeau et le tableau doivent dire la même
 * chose. Deux sens :
 *
 *  - à l'arrivée (lien suivi, lien partagé), les communes de l'adresse
 *    deviennent les communes cochées de la sélection — ajoutées si elles n'y
 *    étaient pas, les autres décochées mais gardées ;
 *  - ensuite, cocher ou décocher dans le bandeau réécrit l'adresse, et le
 *    tableau suit.
 *
 * L'adresse reste la photographie partageable ; la sélection reste locale.
 */
export function SynchroniserComparaison({ communes }: { communes: CommuneReperable[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { selection, aligner } = useSelection();
  const slugsAdresse = communes.map((c) => c.slug).join(",");
  const aligneSur = useRef<string | null>(null);

  // 1. L'adresse gouverne à l'arrivée et à chaque changement d'adresse.
  useEffect(() => {
    if (aligneSur.current === slugsAdresse) return;
    aligneSur.current = slugsAdresse;
    if (communes.length > 0) aligner(communes);
  }, [slugsAdresse, communes, aligner]);

  // 2. Puis la sélection gouverne : les cochées réécrivent l'adresse.
  useEffect(() => {
    if (aligneSur.current !== slugsAdresse) return; // alignement en cours
    const cochees = comparees(selection).map((c) => c.slug);
    const actuelles = decoderSlugs(params.get(PARAM_COMPARAISON));
    if (cochees.join(",") === actuelles.join(",")) return;
    if (cochees.length === 0 && actuelles.length === 0) return;
    router.replace(cochees.length ? lienComparaison(cochees) : pathname, { scroll: false });
  }, [selection, params, pathname, router, slugsAdresse]);

  return null;
}
