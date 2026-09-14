import type { Metadata } from "next";

import { CRITERES } from "@/lib/criteres";
import { getCommunes, getSourcesElectorales, getSourcesParCritere, getZones } from "@/lib/donnees";
import { dateCourte } from "@/lib/format";
import type { CritereId, Source } from "@/lib/types";

export const metadata: Metadata = {
  title: "Sources et méthode",
  description:
    "D'où viennent les chiffres, comment le classement est calculé, et ce que ce comparateur ne sait pas faire.",
};

/** Une source par critère, dédupliquée sur l'URL et le millésime. */
function sourcesParCritere(): { critere: CritereId; libelle: string; sources: Source[] }[] {
  const detail = getSourcesParCritere();
  return CRITERES.map((critere) => ({
    critere: critere.id,
    libelle: critere.libelle,
    sources: detail.filter((d) => d.critere === critere.id).map((d) => d.source),
  }));
}

function sourcesElectorales(): Source[] {
  return getSourcesElectorales();
}

/** Chaque source avec son producteur, son millésime, sa licence et le lien vers le jeu de données. */
function ListeSources({ sources }: { sources: Source[] }) {
  if (sources.length === 0) {
    return <p className="text-[13.5px] text-texte-faible">Aucune source enregistrée pour ce critère.</p>;
  }
  return (
    <ul className="space-y-2.5">
      {sources.map((source) => (
        <li key={`${source.url}|${source.annee}`} className="text-[13.5px] leading-snug">
          <span className="font-medium">{source.nom}</span>
          <span className="text-texte-doux">
            {" "}
            — {source.producteur}, {source.annee}
            {source.licence ? ` · ${source.licence}` : ""}
          </span>
          {source.url && (
            <>
              {" "}
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent underline underline-offset-2"
              >
                Jeu de données
              </a>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Methodologie() {
  const nbCommunes = getCommunes().length;
  const zones = getZones();

  return (
    <div className="pb-4">
      <header className="pt-3 pb-7">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[34px]">
          Sources et méthode
        </h1>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-texte-doux">
          Ce comparateur n&apos;a d&apos;intérêt que si l&apos;on peut vérifier ce qu&apos;il
          affiche. Cette page dit d&apos;où vient chaque chiffre, comment le classement est calculé,
          et ce que la méthode ne permet pas de conclure.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <section className="rounded-2xl border border-trait bg-carte p-5 shadow-carte sm:p-6">
          <h2 className="text-[17px] font-semibold tracking-tight">
            Comment le classement est calculé
          </h2>
          <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-texte-doux">
            <p>
              Aucune note n&apos;est attribuée à une commune. Pour chaque mesure, on compte
              simplement{" "}
              <span className="text-texte">
                combien des autres communes comparées celle-ci devance
              </span>{" "}
              — c&apos;est exactement la phrase affichée : « moins cher que 72 % des autres villes
              comparées ». Quand beaucoup de communes ont la même valeur, la part à égalité est
              annoncée à côté, parce qu&apos;une commune sans gare n&apos;est pas « devancée » par
              les seize autres qui n&apos;en ont pas non plus.
            </p>
            <p>
              Pour <em>trier</em>, en revanche, les ex æquo comptent pour une demi-victoire de part
              et d&apos;autre : sans cela, une valeur très répandue écraserait le classement. Ce
              rang sert au tri et à la longueur des barres ; il n&apos;est jamais transformé en une
              affirmation sur un nombre de communes.
            </p>
            <p>
              Quand un critère repose sur plusieurs mesures — les écoles, par exemple, combinent
              densité d&apos;établissements et taux de réussite — sa position est la moyenne simple
              des positions de ces mesures. Aucune pondération cachée : chaque fiche de commune
              détaille les mesures retenues.
            </p>
            <p>
              Vos curseurs fixent le poids de chaque critère. Le rang final est la moyenne de ces
              positions pondérée par vos poids. Ce nombre sert uniquement à trier : il n&apos;est
              jamais affiché comme une note, parce qu&apos;il n&apos;aurait pas de sens en dehors de
              vos réglages.
            </p>
            <p>
              <span className="text-texte">Donnée manquante :</span> le critère concerné est retiré
              du calcul pour cette commune — du numérateur comme du dénominateur. Elle n&apos;est ni
              avantagée ni pénalisée, et l&apos;omission est signalée sur sa ligne.
            </p>
            <p>
              <span className="text-texte">Filtrer par localisation ou par valeur</span> ne change
              jamais contre quoi une commune est comparée : les phrases restent calibrées sur les{" "}
              {nbCommunes} communes du jeu complet, pas sur le sous-ensemble affiché. Filtrer change
              qui est classé, jamais le jeu de comparaison.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-trait bg-carte p-5 shadow-carte sm:p-6">
          <h2 className="text-[17px] font-semibold tracking-tight">
            Ce que ce comparateur ne dit pas
          </h2>
          <ul className="mt-3 space-y-2.5 text-[14px] leading-relaxed text-texte-doux">
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-signal">
                —
              </span>
              <span>
                Les positions se rapportent aux {nbCommunes} communes de ce jeu de test, pas à la
                France entière. Une commune « dans la moyenne » ici peut être atypique à
                l&apos;échelle nationale.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-signal">
                —
              </span>
              <span>
                Une moyenne communale masque les écarts entre quartiers, parfois considérables sur
                le prix comme sur la sécurité.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-signal">
                —
              </span>
              <span>
                Les millésimes diffèrent d&apos;un critère à l&apos;autre : chaque chiffre porte son
                année, il n&apos;y a pas de photographie à une date unique.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-signal">
                —
              </span>
              <span>
                L&apos;historique électoral est présenté à titre d&apos;information factuelle. Il
                n&apos;entre dans aucun calcul et n&apos;influence aucun classement.
              </span>
            </li>
          </ul>
        </section>

        {sourcesParCritere().map((groupe) => (
          <section
            key={groupe.critere}
            className="rounded-2xl border border-trait bg-carte p-5 shadow-carte sm:p-6"
          >
            <h2 className="text-[17px] font-semibold tracking-tight">{groupe.libelle}</h2>
            <div className="mt-3">
              <ListeSources sources={groupe.sources} />
            </div>
          </section>
        ))}

        <section className="rounded-2xl border border-trait bg-carte p-5 shadow-carte sm:p-6">
          <h2 className="text-[17px] font-semibold tracking-tight">Résultats électoraux</h2>
          <div className="mt-3">
            <ListeSources sources={sourcesElectorales()} />
          </div>
        </section>
      </div>

      {zones.length > 0 && (
        <ul className="chiffres mt-6 space-y-0.5 text-[12.5px] text-texte-faible">
          {zones.map((zone) => (
            <li key={zone.nom}>
              {zone.nom} : {zone.nbCommunes} communes, jeu assemblé le {dateCourte(zone.genereLe)}.
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
