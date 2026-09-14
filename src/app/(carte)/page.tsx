import { Comparateur } from "@/components/Comparateur";
import { POIDS_PAR_DEFAUT } from "@/lib/criteres";
import { construireApercu } from "@/lib/apercu";
import { getNoyau, getSourcesResumees } from "@/lib/donnees";
import { decoderCouverture, PARAM_COUVERTURE } from "@/lib/couverture";
import { decoderFiltres, PARAM_FILTRES } from "@/lib/filtres";
import { decoderDepartements, PARAM_DEPARTEMENTS } from "@/lib/localisation";
import { decoderPoids, PARAM_POIDS } from "@/lib/poids";
import { decoderRepere, PARAM_REPERE } from "@/lib/repere";

/**
 * Les priorités, les filtres et la localisation voyagent dans l'URL pour être
 * partageables. Ils sont donc lus ici, au rendu : sans cela la page servie
 * afficherait le classement par défaut, y compris à qui reçoit un lien réglé
 * — et définitivement si le navigateur n'exécute pas le script.
 *
 * Aucune localisation n'est demandée au préalable : toutes les communes de
 * toutes les régions peuplées sont comparées d'entrée, la localisation
 * n'étant qu'un filtre parmi d'autres (par département).
 */
export default async function Accueil({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const poidsInitiaux = decoderPoids(params[PARAM_POIDS]) ?? POIDS_PAR_DEFAUT;
  const filtresInitiaux = decoderFiltres(params[PARAM_FILTRES]);
  const departementsInitiaux = decoderDepartements(params[PARAM_DEPARTEMENTS]);
  const couvertureInitiale = decoderCouverture(params[PARAM_COUVERTURE]);

  const noyau = getNoyau();
  const sources = getSourcesResumees();
  const repereInitial = decoderRepere(params[PARAM_REPERE], (code) => {
    const i = noyau.communes.codeInsee.indexOf(code);
    const lat = i >= 0 ? noyau.communes.lat[i] : null;
    const lon = i >= 0 ? noyau.communes.lon[i] : null;
    return lat !== null && lon !== null ? { nom: noyau.communes.nom[i], lat, lon } : undefined;
  });
  // Le classement demandé par l'URL, calculé ici avec les mêmes fonctions que
  // le navigateur : la page arrive complète, le noyau (34 746 communes) est
  // chargé à côté, en cache immuable, pour animer les curseurs.
  const apercu = construireApercu(noyau, {
    poids: poidsInitiaux,
    filtres: filtresInitiaux,
    departements: departementsInitiaux,
    couverture: couvertureInitiale,
    repere: repereInitial,
  });

  if (noyau.communes.codeInsee.length === 0) {
    return (
      <p className="m-6 rounded-xl border border-trait bg-doux px-4 py-3 text-[13.5px] text-texte-doux">
        Le jeu de données n&apos;est pas encore généré.
      </p>
    );
  }

  return (
    <Comparateur
      apercu={apercu}
      noyauUrl={`/donnees/noyau/${noyau.empreinte}`}
      sources={sources}
      poidsInitiaux={poidsInitiaux}
      filtresInitiaux={filtresInitiaux}
      departementsInitiaux={departementsInitiaux}
      couvertureInitiale={couvertureInitiale}
      repereInitial={repereInitial}
    />
  );
}
