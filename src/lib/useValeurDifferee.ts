import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sépare la valeur affichée d'un curseur (mise à jour à chaque pixel glissé,
 * pour un retour visuel instantané) de sa valeur *commise* (transmise au
 * parent seulement au relâchement). Au-delà de quelques centaines de
 * communes, recalculer le classement et rejouer l'animation de toute la
 * liste à chaque tick de glissement — potentiellement cent fois par seconde
 * — devient perceptible ; ce recalcul ne doit se produire qu'une fois, quand
 * l'utilisateur relâche le curseur.
 *
 * `valeurExterne` peut changer sans passer par `commettre` (bouton
 * Réinitialiser, lien partagé, changement de filtre ailleurs) : la valeur
 * locale se resynchronise alors dessus.
 */
export function useValeurDifferee<T>(valeurExterne: T, onCommit: (valeur: T) => void) {
  const [valeurLocale, setValeurLocale] = useState(valeurExterne);
  useEffect(() => {
    setValeurLocale(valeurExterne);
  }, [valeurExterne]);

  // Toujours la dernière valeur locale au moment du relâchement, sans dépendre
  // d'un `onCommit` qui changerait de référence entre l'affichage et le commit.
  const ref = useRef(valeurLocale);
  ref.current = valeurLocale;

  const commettre = useCallback(() => onCommit(ref.current), [onCommit]);

  return [valeurLocale, setValeurLocale, commettre] as const;
}
