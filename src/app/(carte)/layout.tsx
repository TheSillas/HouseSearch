/**
 * Gabarit de l'accueil : une application qui tient dans l'écran. La carte et
 * le panneau se partagent la hauteur du viewport ; seules les listes défilent,
 * jamais la page — voir Comparateur.tsx pour la disposition elle-même.
 *
 * `detail` est un emplacement parallèle : quand on ouvre une commune depuis la
 * carte, la route /ville/<slug> y est interceptée et rendue en volet
 * par-dessus le panneau, sans quitter la carte (voir @detail). Rechargée ou
 * partagée, la même adresse donne la fiche entière.
 */
export default function LayoutCarte({
  children,
  detail,
}: {
  children: React.ReactNode;
  detail: React.ReactNode;
}) {
  return (
    // `relative` : les éléments masqués visuellement (`sr-only`, donc en
    // position absolue) des lignes du classement doivent avoir un ancêtre
    // positionné à l'intérieur de ce cadre — sinon leur position statique,
    // loin dans la liste, allonge le document et fait défiler la page.
    <main id="contenu" className="relative h-dvh overflow-hidden">
      {children}
      {detail}
    </main>
  );
}
