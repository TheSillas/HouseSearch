import { ChromeSite } from "@/components/ChromeSite";
import { Introuvable } from "@/components/Introuvable";

/** Adresse inconnue de toute l'application : le gabarit racine n'a pas
 * d'habillage, on le pose ici explicitement. */
export default function IntrouvableRacine() {
  return (
    <ChromeSite>
      <Introuvable />
    </ChromeSite>
  );
}
