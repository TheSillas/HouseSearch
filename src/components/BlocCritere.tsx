import { BarrePosition } from "./BarrePosition";
import { CourbeEvolution } from "./CourbeEvolution";
import { libellePeriode } from "@/lib/courbe";
import { phraseComparative, valeurMesure } from "@/lib/format";
import { mesurePosition, mesureVedette } from "@/lib/mesures";
import { Repartition } from "./Repartition";
import type { Referentiel } from "@/lib/scoring";
import type { CritereDonnees, CritereMeta, Mesure } from "@/lib/types";

/**
 * Une mesure sur la fiche : le chiffre brut, sa précision, puis sa position.
 *
 * La structure suit ce qu'un `<dl>` autorise — un `<div>` de groupe contenant
 * uniquement des `<dt>` et des `<dd>` — d'où le second `<dd>` qui porte tout ce
 * qui vient sous le chiffre.
 */
function LigneMesure({
  mesure,
  referentiel,
  codeInsee,
}: {
  mesure: Mesure;
  referentiel: Referentiel;
  codeInsee: string;
}) {
  const comparable = mesure.comparable !== false;
  const position = comparable ? (referentiel.positions[codeInsee]?.[mesure.id] ?? null) : null;
  const phrase = phraseComparative(mesure, position);
  const absente = mesure.valeur === null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-t border-trait py-3.5 first:border-t-0 first:pt-0">
      <dt className="text-[13.5px] leading-snug text-texte-doux">{mesure.libelle}</dt>
      <dd
        className={`chiffres text-right text-[17px] font-semibold tabular-nums ${
          absente ? "text-[14px] font-normal text-texte-faible" : ""
        }`}
      >
        {valeurMesure(mesure)}
      </dd>

      <dd className="col-span-2">
        {/* Une précision qui détaille un calcul n'a pas de sens si le calcul
            n'a pas abouti : on la tait quand la valeur est absente. */}
        {mesure.precision && !absente && (
          <p className="chiffres mt-1 text-[12px] text-texte-faible">{mesure.precision}</p>
        )}

        {mesure.repartition && mesure.repartition.length > 0 && !absente && (
          <Repartition postes={mesure.repartition} />
        )}

        {mesure.maille && (
          <p className="mt-1 text-[12px] text-signal">
            Donnée de maille {mesure.maille}, et non communale.
          </p>
        )}

        {mesure.source && (
          <p className="mt-1 break-words text-[12px] text-texte-faible">
            Source : {mesure.source.nomCourt ?? mesure.source.nom} — {mesure.source.producteur},{" "}
            {mesure.source.annee}.{" "}
            <a
              href={mesure.source.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent underline underline-offset-2"
            >
              Jeu de données
            </a>
          </p>
        )}

        {!absente && comparable && phrase && (
          <div className="mt-2.5">
            {/* La phrase juste en dessous porte déjà l'information : annoncer la
                barre la répéterait mot pour mot aux lecteurs d'écran. */}
            <BarrePosition position={position} hauteur="epaisse" decoratif />
            <p className="mt-1.5 text-[12.5px] text-texte-doux">
              {phrase}
              {position && (
                <span className="text-texte-faible">
                  {" "}
                  · <span className="chiffres">{position.effectif.toLocaleString("fr-FR")}</span> communes renseignées
                </span>
              )}
            </p>
          </div>
        )}

        {absente && (
          <p className="mt-1 text-[12.5px] text-texte-faible">
            {messageAbsence(mesure)} Elle n&apos;est remplacée ni par une estimation, ni par une
            moyenne.
          </p>
        )}

        {mesure.historique && (
          <details className="group mt-2.5">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 py-0.5 text-[12px] text-texte-faible underline decoration-trait-fort underline-offset-2 marker:content-none">
              <svg
                className="h-2.5 w-2.5 transition-transform group-open:rotate-90"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m4.5 2.5 3 3.5-3 3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Évolution {libellePeriode(mesure.historique)}
            </summary>
            <div className="mt-2">
              <CourbeEvolution
                points={mesure.historique}
                unite={mesure.unite}
                decimales={mesure.decimales}
                libelle={mesure.libelle}
              />
            </div>
          </details>
        )}
      </dd>
    </div>
  );
}

function messageAbsence(mesure: Mesure): string {
  switch (mesure.statut) {
    case "secret_statistique":
      return "Valeur couverte par le secret statistique : le producteur ne la publie pas pour cette commune.";
    case "sans_objet":
      return "Sans objet pour cette commune : ce prélèvement n'y est pas appliqué.";
    case "seuil_diffusion":
      return "Valeur non diffusée par le producteur pour cette commune (seuils de diffusion ou de qualité).";
    case "echantillon_insuffisant":
      return "Trop peu de ventes pour publier un chiffre fiable sur cette commune.";
    case "indisponible":
      return "Cette source ne couvre pas ce territoire (voir méthode et limites).";
    default:
      return "Aucune valeur publiée pour cette commune.";
  }
}

function Chevron() {
  return (
    <svg
      className="mt-1 h-4 w-4 shrink-0 text-texte-faible transition-transform group-open:rotate-90"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Un critère de la fiche, en deux profondeurs.
 *
 * Replié — l'état par défaut — il ne montre que l'essentiel : la donnée
 * vedette en gros, ce qu'elle mesure, et sa position parmi les communes
 * comparées en une phrase et une barre. Quatre blocs ainsi repliés tiennent
 * dans un écran : la fiche se parcourt d'un regard.
 *
 * Déplié, il donne tout : chaque mesure publiée avec sa précision, sa
 * position et son évolution, puis la source et ses limites. Rien n'est
 * perdu, tout est à un clic.
 *
 * Le résumé vit dans un `<summary>` : il n'admet que du contenu de phrasé (et
 * un titre), d'où des `<span>` mis en forme plutôt que des `<div>`/`<p>`.
 */
export function BlocCritere({
  meta,
  donnees,
  referentiel,
  codeInsee,
}: {
  meta: CritereMeta;
  donnees: CritereDonnees | undefined;
  referentiel: Referentiel;
  codeInsee: string;
}) {
  if (!donnees) {
    return (
      <section
        id={`critere-${meta.id}`}
        className="rounded-2xl border border-trait bg-carte p-5 shadow-carte sm:px-6"
      >
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-texte-doux">
          {meta.libelle}
        </h2>
        <p className="chiffres mt-1 text-[26px] font-semibold leading-none text-texte-faible">—</p>
        <p className="mt-2 text-[13px] text-texte-faible">
          Aucune donnée disponible pour cette commune.
        </p>
      </section>
    );
  }

  const positionCritere = referentiel.positionsCriteres[codeInsee]?.[meta.id] ?? null;
  const partiel =
    positionCritere !== null && positionCritere.mesuresRetenues < positionCritere.mesuresAttendues;

  const vedette = mesureVedette(donnees.mesures);
  const valeurVedette = vedette ? valeurMesure(vedette) : "—";
  // La position peut venir d'une autre mesure que la vedette (un décompte
  // d'établissements se lit tel quel ; c'est la densité qui classe) : on
  // l'indique alors sous la phrase.
  const mesurePos = mesurePosition(donnees.mesures, vedette);
  const positionVedette = mesurePos
    ? (referentiel.positions[codeInsee]?.[mesurePos.id] ?? null)
    : null;
  const phraseVedette = mesurePos ? phraseComparative(mesurePos, positionVedette) : null;
  const positionIndirecte = mesurePos && vedette && mesurePos.id !== vedette.id;
  const vedetteAbsente = !vedette || vedette.valeur === null;
  const nbRenseignees = donnees.mesures.filter((m) => m.valeur !== null).length;

  return (
    <details
      id={`critere-${meta.id}`}
      className="group scroll-mt-4 rounded-2xl border border-trait bg-carte shadow-carte transition-colors open:border-trait-fort"
    >
      {/* Replié, le bloc tient en quatre lignes : critère, chiffre, ce qu'il
          mesure, position. La précision (nombre de ventes, effectifs…) et les
          sources attendent dans le détail — six blocs doivent tenir dans un
          écran et demi, pas devenir une page à faire défiler. */}
      <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-3.5 marker:content-none sm:px-6">
        <span className="min-w-0 flex-1">
          {/* Une ligne : le critère et ce qu'on mesure à gauche, le chiffre à
              droite ; en dessous, la position. Le bloc replié tient en ~100 px. */}
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-texte-doux">
                {meta.libelle}
              </h2>
              {vedette && (
                <span className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-texte-doux">
                  {vedette.libelle}
                </span>
              )}
            </span>
            <span className="shrink-0 text-right">
              <span
                className={`chiffres block whitespace-nowrap font-semibold leading-none tabular-nums ${
                  vedetteAbsente
                    ? "text-[15px] font-medium text-texte-faible"
                    : valeurVedette.length > 11
                      ? "text-[18px]"
                      : "text-[22px]"
                }`}
              >
                {valeurVedette}
              </span>
              <span className="chiffres mt-1 block text-[10.5px] text-texte-faible group-open:hidden">
                {nbRenseignees}/{donnees.mesures.length} mesures
                <span className="text-accent"> · détail</span>
              </span>
            </span>
          </span>

          {!vedetteAbsente && phraseVedette && positionVedette && (
            <span className="mt-2 block">
              <BarrePosition position={positionVedette} hauteur="epaisse" decoratif />
              <span className="mt-1.5 block text-[12.5px] leading-snug text-texte-doux">
                {phraseVedette}
                {positionIndirecte && mesurePos && (
                  <span className="text-texte-faible">
                    {" "}
                    · selon {mesurePos.libelle.toLowerCase()}
                  </span>
                )}
              </span>
            </span>
          )}
          {vedette && vedetteAbsente && (
            <span className="mt-2 block text-[12.5px] leading-snug text-texte-faible">
              {messageAbsence(vedette)}
            </span>
          )}
          {partiel && (
            <span className="mt-1.5 block text-[11px] leading-snug text-signal">
              Classé sur {positionCritere.mesuresRetenues} de ses {positionCritere.mesuresAttendues}{" "}
              mesures, la donnée manquante est écartée, pas remplacée.
            </span>
          )}
        </span>
        <Chevron />
      </summary>

      <div className="border-t border-trait px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-texte-doux">
          Toutes les mesures
        </p>
        <dl className="mt-2">
          {donnees.mesures.map((mesure) => (
            <LigneMesure
              key={mesure.id}
              mesure={mesure}
              referentiel={referentiel}
              codeInsee={codeInsee}
            />
          ))}
        </dl>

        <div className="mt-4 border-t border-trait pt-3.5 text-[12.5px] leading-relaxed text-texte-faible">
          {/* `annee` peut être une note technique brute (URL comprise) plutôt
              qu'un simple millésime, pour une région sans texte rédigé : sans
              ce point de rupture, un long token sans espace pousserait toute la
              page en débordement horizontal. */}
          <p className="break-words">
            <span className="text-texte-doux">Source :</span> {donnees.source.nom} —{" "}
            {donnees.source.producteur}, données {donnees.source.annee}.{" "}
            <a
              href={donnees.source.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent underline underline-offset-2"
            >
              Jeu de données
            </a>
          </p>

          {(donnees.methodologie || donnees.caveats.length > 0) && (
            <details className="group/methode mt-2">
              <summary className="cursor-pointer list-none py-1 text-texte-doux underline underline-offset-2 marker:content-none">
                Méthode et limites
              </summary>
              <div className="mt-2 space-y-1.5">
                {donnees.methodologie && <p>{donnees.methodologie}</p>}
                {donnees.caveats.map((caveat, i) => (
                  <p key={i} className="flex gap-1.5">
                    <span aria-hidden="true" className="text-signal">
                      —
                    </span>
                    <span>{caveat}</span>
                  </p>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </details>
  );
}
