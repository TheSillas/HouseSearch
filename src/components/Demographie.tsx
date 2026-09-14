import { nombre } from "@/lib/format";
import type { Demographie as DonneesDemographie } from "@/lib/types";

/**
 * Portrait démographique en trois regards, sur une seule bande : combien
 * d'habitants et dans quel sens ça va, puis qui vit là (une barre d'âges
 * empilée, lisible d'un coup d'œil). Contexte de la fiche, jamais un critère
 * de classement : rien ici n'est noté ni comparé aux autres communes.
 *
 * Les tranches INSEE (sept) sont regroupées en cinq pour la barre — le détail
 * exact reste dans l'infobulle de chaque segment. Aucune valeur recalculée
 * au-delà de sommes et de parts.
 */
const REGROUPEMENTS: { libelle: string; tranches: string[]; teinte: string }[] = [
  { libelle: "0-14 ans", tranches: ["0-14"], teinte: "bg-accent-fort" },
  { libelle: "15-29 ans", tranches: ["15-29"], teinte: "bg-accent" },
  { libelle: "30-59 ans", tranches: ["30-44", "45-59"], teinte: "bg-accent/60" },
  { libelle: "60-74 ans", tranches: ["60-74"], teinte: "bg-accent/35" },
  { libelle: "75 ans et +", tranches: ["75-89", "90+"], teinte: "bg-trait-fort" },
];

function evolution(recent: number | null, ancien: number | null): { pct: number; signe: string } | null {
  if (recent === null || ancien === null || ancien === 0) return null;
  const pct = Math.round(((recent - ancien) / ancien) * 1000) / 10;
  return { pct, signe: pct > 0 ? "+" : "" };
}

export function Demographie({ donnees }: { donnees: DonneesDemographie }) {
  const total = donnees.ages.reduce((s, a) => s + (a.effectif ?? 0), 0);
  const parTranche = new Map(donnees.ages.map((a) => [a.tranche, a.effectif ?? 0]));
  const segments = REGROUPEMENTS.map((g) => {
    const effectif = g.tranches.reduce((s, t) => s + (parTranche.get(t) ?? 0), 0);
    return { ...g, effectif, part: total > 0 ? (effectif / total) * 100 : 0 };
  });
  const evol = evolution(donnees.population2022, donnees.population2016);
  const evolLongue = evolution(donnees.population2022, donnees.population2011);
  const partSeniors = segments.slice(3).reduce((s, g) => s + g.part, 0);
  const partJeunes = segments[0].part;

  return (
    <section
      aria-label="Démographie"
      className="rounded-2xl border border-trait bg-doux/60 px-4 py-3.5 sm:px-5"
    >
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-doux">
            Habitants (2022)
          </p>
          <p className="chiffres text-[22px] font-semibold leading-none tabular-nums">
            {donnees.population2022 !== null ? nombre(donnees.population2022) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-doux">
            Depuis 2016
          </p>
          <p className="chiffres text-[22px] font-semibold leading-none tabular-nums">
            {evol ? `${evol.signe}${nombre(evol.pct, 1)} %` : "—"}
          </p>
          {evolLongue && (
            <p className="chiffres mt-0.5 text-[11.5px] text-texte-faible">
              {evolLongue.signe}
              {nombre(evolLongue.pct, 1)} % depuis 2011
            </p>
          )}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-doux">
            Moins de 15 ans
          </p>
          <p className="chiffres text-[22px] font-semibold leading-none tabular-nums">
            {total > 0 ? `${nombre(partJeunes, 0)} %` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-doux">
            60 ans et plus
          </p>
          <p className="chiffres text-[22px] font-semibold leading-none tabular-nums">
            {total > 0 ? `${nombre(partSeniors, 0)} %` : "—"}
          </p>
        </div>
      </div>

      {total > 0 && (
        <>
          <div
            className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-carte"
            role="img"
            aria-label={`Répartition par âge : ${segments
              .map((s) => `${s.libelle} ${nombre(s.part, 0)} %`)
              .join(", ")}`}
          >
            {segments.map((s) => (
              <span
                key={s.libelle}
                className={`h-full ${s.teinte}`}
                style={{ width: `${s.part}%` }}
                title={`${s.libelle} : ${nombre(s.effectif)} habitants (${nombre(s.part, 1)} %)`}
              />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] text-texte-doux" aria-hidden="true">
            {segments.map((s) => (
              <li key={s.libelle} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${s.teinte}`} />
                {s.libelle} <span className="chiffres text-texte-faible">{nombre(s.part, 0)} %</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-2 text-[11px] text-texte-faible">
        Source : {donnees.source.producteur}, recensement {donnees.source.annee}. Contexte, hors classement.
      </p>
    </section>
  );
}
