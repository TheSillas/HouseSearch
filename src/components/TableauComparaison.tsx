"use client";

import Link from "next/link";
import { useState } from "react";

import { BarrePosition } from "./BarrePosition";
import { Repartition } from "./Repartition";
import { lienComparaison, plusFavorables } from "@/lib/comparaison";
import { CRITERES } from "@/lib/criteres";
import { nomDepartement } from "@/lib/departements";
import { dateCourte, nombre, phraseComparative, valeurMesure } from "@/lib/format";
import { mesurePosition, mesureVedette } from "@/lib/mesures";
import type { PositionsParMesure } from "@/lib/scoring";
import type { Commune, CritereId, Mesure, Scrutin, Source } from "@/lib/types";

/**
 * Deux à six communes côte à côte. Comme les blocs de la fiche : une ligne
 * synthétique par critère — son chiffre vedette pour chaque commune, la valeur
 * la plus favorable en couleur, la barre de position parmi toutes les communes
 * du comparateur — qui se déplie sur toutes les mesures du critère, avec leurs
 * précisions et leurs répartitions (quels commerces, quels spécialistes…).
 * Une section Vie politique reprend maire, nuance et listes arrivées en tête,
 * telles que publiées. Aucune note, aucun total ; les sources sous le tableau.
 */
export function TableauComparaison({
  communes,
  positions,
  nbCommunesComparees,
}: {
  communes: Commune[];
  /** codeInsee → mesureId → position, pour les seules communes comparées. */
  positions: Record<string, PositionsParMesure>;
  nbCommunesComparees: number;
}) {
  const slugs = communes.map((c) => c.slug);
  const groupes: GroupeId[] = [...CRITERES.map((c) => c.id), "politique"];
  const [ouverts, setOuverts] = useState<Set<GroupeId>>(() => new Set());
  const basculer = (id: GroupeId) =>
    setOuverts((s) => {
      const suivant = new Set(s);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  const toutOuvert = groupes.every((g) => ouverts.has(g));

  return (
    <>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setOuverts(toutOuvert ? new Set() : new Set(groupes))}
          className="rounded-full border border-trait px-3 py-1.5 text-[12.5px] text-texte-doux transition-colors hover:border-trait-fort hover:text-texte"
        >
          {toutOuvert ? "Tout replier" : "Tout déplier"}
        </button>
      </div>

      {/* Le tableau défile dans son propre cadre, la colonne des libellés
          collée à gauche ; la page ne défile jamais horizontalement. */}
      {/* Une carte, comme les blocs de la fiche : cadre arrondi, fond uni — la
          colonne collante partage ce fond et ne fait pas de bloc à part. */}
      <div className="overflow-x-auto rounded-2xl border border-trait bg-carte shadow-carte">
        {/* Largeurs fixées une fois pour toutes (240 px de libellés, 220 px par
            commune) : déplier un critère ne fait pas bouger les colonnes, les
            textes longs passent à la ligne dans leur cellule. Plus large que
            son cadre, le tableau défile ; moins large, il l'occupe. */}
        <table
          className="table-fixed border-collapse text-[13.5px]"
          style={{ width: `${LARGEUR_LIBELLES + communes.length * LARGEUR_COMMUNE}px`, minWidth: "100%" }}
        >
          <colgroup>
            <col style={{ width: `${LARGEUR_LIBELLES}px` }} />
            {communes.map((c) => (
              <col key={c.codeInsee} style={{ width: `${LARGEUR_COMMUNE}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr className="align-top">
              <th scope="col" className="sticky left-0 z-10 border-r border-trait/60 bg-carte px-3 pt-3 pb-3 text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-texte-doux">
                Critère
              </th>
              {communes.map((commune) => (
                <th key={commune.codeInsee} scope="col" className="border-l border-trait/60 pt-3 pb-3 pl-3 pr-3 text-right font-normal break-words">
                  <Link href={`/ville/${commune.slug}`} className="text-[15px] font-semibold leading-tight text-texte hover:text-accent">
                    {commune.nom}
                  </Link>
                  <div className="chiffres mt-0.5 text-[12px] leading-snug text-texte-faible">
                    {nomDepartement(commune.departement)} · {nombre(commune.population)} hab.
                  </div>
                  {communes.length > 2 && (
                    <Link
                      href={lienComparaison(slugs.filter((s) => s !== commune.slug))}
                      className="mt-1 inline-block text-[12px] text-texte-faible underline-offset-2 hover:text-accent hover:underline"
                    >
                      Retirer
                    </Link>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {CRITERES.map((meta) => {
            const lignes = lignesDuCritere(meta.id, communes);
            if (lignes.length === 0) return null;
            const ouvert = ouverts.has(meta.id);
            // Ligne synthétique : la mesure vedette de chaque commune, comme sur la fiche.
            const vedettes = communes.map((c) => {
              const mesures = c.criteres[meta.id]?.mesures;
              return mesures ? (mesureVedette(mesures) ?? null) : null;
            });
            const modele = vedettes.find(Boolean) ?? null;
            const comparable = modele?.comparable !== false;
            const favorables =
              modele && comparable
                ? plusFavorables(vedettes.map((m) => m?.valeur ?? null), modele.sens)
                : vedettes.map(() => false);
            return (
              <tbody key={meta.id} className="border-t border-trait">
                <tr className="align-top">
                  <th scope="row" className="sticky left-0 z-10 border-r border-trait/60 bg-carte py-2.5 pl-3 pr-3 text-left font-normal">
                    <button
                      type="button"
                      onClick={() => basculer(meta.id)}
                      aria-expanded={ouvert}
                      aria-controls={`detail-${meta.id}`}
                      className="group flex w-full items-start gap-1.5 text-left"
                    >
                      <Chevron ouvert={ouvert} />
                      <span className="min-w-0">
                        <span className="block text-[12px] font-semibold uppercase tracking-[0.08em] text-texte-doux group-hover:text-accent">
                          {meta.libelle}
                        </span>
                        {modele && <span className="block text-[12.5px] leading-snug text-texte-faible">{modele.libelle}</span>}
                        <span className="chiffres block text-[11.5px] text-texte-faible">
                          {lignes.length} mesure{lignes.length > 1 ? "s" : ""} · {ouvert ? "replier" : "détail"}
                        </span>
                      </span>
                    </button>
                  </th>
                  {vedettes.map((m, i) => {
                    const commune = communes[i];
                    const mesures = commune.criteres[meta.id]?.mesures;
                    const mesurePos = mesures && m ? mesurePosition(mesures, m) : undefined;
                    const position = mesurePos && mesurePos.valeur !== null ? (positions[commune.codeInsee]?.[mesurePos.id] ?? null) : null;
                    const phrase = mesurePos && position ? phraseComparative(mesurePos, position) : null;
                    return (
                      <td key={commune.codeInsee} className="border-l border-trait/60 py-2.5 pl-3 pr-3 text-right">
                        <span
                          className={`chiffres block text-[15px] font-semibold leading-snug ${
                            favorables[i] ? "text-accent-fort" : m && m.valeur !== null ? "text-texte" : "font-normal text-texte-faible"
                          }`}
                        >
                          {m ? valeurMesure(m) : "—"}
                        </span>
                        {position && (
                          <span className="mt-1.5 block">
                            <BarrePosition position={position} libelleAccessible={phrase ?? undefined} />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                {ouvert &&
                  lignes.map(({ id, modele: mod, mesures }) => {
                    const comp = mod.comparable !== false;
                    const fav = comp ? plusFavorables(mesures.map((m) => m?.valeur ?? null), mod.sens) : mesures.map(() => false);
                    return (
                      <tr key={id} id={id === lignes[0].id ? `detail-${meta.id}` : undefined} className="border-t border-trait/60 bg-doux/30 align-top">
                        <th scope="row" className="sticky left-0 z-10 border-r border-trait/60 bg-carte py-2 pl-7 pr-3 text-left text-[13px] font-normal leading-snug text-texte-doux">
                          {mod.libelle}
                        </th>
                        {mesures.map((m, i) => {
                          const commune = communes[i];
                          const position = m && comp && m.valeur !== null ? (positions[commune.codeInsee]?.[m.id] ?? null) : null;
                          const phrase = m && position ? phraseComparative(m, position) : null;
                          return (
                            <td key={commune.codeInsee} className="border-l border-trait/60 py-2 pl-3 pr-3 text-right break-words">
                              <span
                                className={`chiffres block text-[14px] leading-snug ${
                                  fav[i] ? "font-semibold text-accent-fort" : m && m.valeur !== null ? "text-texte" : "text-texte-faible"
                                }`}
                              >
                                {m ? valeurMesure(m) : "—"}
                              </span>
                              {m?.maille ? (
                                // Une maille se lit en un mot ici (« Abbeville · 41,6 km ») ; la
                                // phrase complète et la précision restent dans l'infobulle. Six
                                // fois la même mise en garde par colonne noyait les chiffres.
                                <span
                                  className="mt-0.5 block truncate text-[11.5px] leading-snug text-texte-faible"
                                  title={`Donnée de maille ${m.maille}, et non communale.${m.precision ? ` ${m.precision}.` : ""}`}
                                >
                                  maille : {mailleCourte(m.maille)}
                                </span>
                              ) : (
                                m?.precision && <span className="mt-0.5 block text-[11.5px] leading-snug text-texte-faible">{m.precision}</span>
                              )}
                              {position && (
                                <span className="mt-1.5 block">
                                  <BarrePosition position={position} libelleAccessible={phrase ?? undefined} />
                                </span>
                              )}
                              {m?.repartition && m.repartition.length > 0 && (
                                <div className="text-left">
                                  <Repartition postes={m.repartition} colonnes={1} />
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            );
          })}

          <Politique communes={communes} ouvert={ouverts.has("politique")} onBasculer={() => basculer("politique")} />
        </table>
      </div>

      <p className="mt-4 text-[12.5px] leading-relaxed text-texte-faible">
        En couleur : la valeur la plus favorable parmi les communes comparées, pour les mesures
        qui ont un sens (un prix plus bas, un taux de réussite plus haut). Les barres situent
        chaque commune parmi les {nombre(nbCommunesComparees)} communes du comparateur, pas
        seulement parmi celles-ci. « — » : critère sans donnée pour cette commune.
      </p>

      <Sources communes={communes} />
    </>
  );
}

type GroupeId = CritereId | "politique";

const LARGEUR_LIBELLES = 240;

/**
 * « station Météo-France Abbeville (69 m d'altitude, à 41,6 km) » → « Abbeville · 41,6 km » ;
 * toute autre maille garde son texte, débarrassé d'une parenthèse explicative.
 */
function mailleCourte(maille: string): string {
  const station = maille.match(/^station Météo-France (.+?) \((?:.*?, )?à ([\d,\s ]+km)\)$/u);
  if (station) return `${station[1]} · ${station[2]}`;
  return maille.replace(/\s*\(.*\)\s*$/u, "");
}
const LARGEUR_COMMUNE = 220;

function Chevron({ ouvert }: { ouvert: boolean }) {
  return (
    <svg
      className={`mt-0.5 h-3 w-3 shrink-0 text-texte-faible transition-transform ${ouvert ? "rotate-90" : ""}`}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path d="m4.5 2.5 3 3.5-3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

interface Ligne {
  id: string;
  /** La première mesure rencontrée sous cet identifiant : libellé, sens, unité de référence. */
  modele: Mesure;
  /** Une entrée par commune, dans l'ordre ; null quand la commune n'a pas cette mesure. */
  mesures: (Mesure | null)[];
}

/**
 * Les lignes d'un critère : l'union des mesures des communes comparées, dans
 * l'ordre où la première commune qui les porte les déclare. Les séries
 * historiques ne sont pas reprises ici.
 */
function lignesDuCritere(critere: CritereId, communes: Commune[]): Ligne[] {
  const ordre: string[] = [];
  const modeles = new Map<string, Mesure>();
  for (const commune of communes) {
    for (const m of commune.criteres[critere]?.mesures ?? []) {
      if (!modeles.has(m.id)) {
        modeles.set(m.id, m);
        ordre.push(m.id);
      }
    }
  }
  return ordre.map((id) => ({
    id,
    modele: modeles.get(id)!,
    mesures: communes.map((c) => c.criteres[critere]?.mesures.find((m) => m.id === id) ?? null),
  }));
}

/** Nuance telle que publiée par le ministère : le code en badge, le libellé à côté ; aucune couleur. */
function Nuance({ code, libelle }: { code?: string; libelle?: string }) {
  if (!code) return null;
  return (
    <span className="block text-[12px] text-texte-doux">
      <span className="rounded border border-trait px-1 py-px align-middle text-[10.5px] uppercase tracking-wide text-texte-faible">{code}</span>{" "}
      {libelle ?? code}
    </span>
  );
}

/**
 * Vie politique : le maire en exercice et, déplié, la nuance de sa liste et la
 * liste arrivée en tête à chaque scrutin disponible. Libellés et nuances tels
 * que le ministère de l'Intérieur les publie ; aucune couleur, aucun qualificatif.
 */
function Politique({ communes, ouvert, onBasculer }: { communes: Commune[]; ouvert: boolean; onBasculer: () => void }) {
  if (communes.every((c) => !c.politique.maire && c.politique.scrutins.length === 0)) return null;
  const scrutins = new Map<string, string>();
  for (const c of communes) for (const s of c.politique.scrutins) if (!scrutins.has(s.id)) scrutins.set(s.id, s.nom + (s.tour ? ` — ${s.tour}` : ""));
  const enTete = (s: Scrutin) => [...s.resultats].sort((a, b) => b.pourcentage - a.pourcentage)[0];
  const cellule = "border-l border-trait/60 py-2 pl-3 pr-3 text-right text-[13px] leading-snug";

  return (
    <tbody className="border-t border-trait">
      <tr className="align-top">
        <th scope="row" className="sticky left-0 z-10 border-r border-trait/60 bg-carte py-2.5 pl-3 pr-3 text-left font-normal">
          <button type="button" onClick={onBasculer} aria-expanded={ouvert} aria-controls="detail-politique" className="group flex w-full items-start gap-1.5 text-left">
            <Chevron ouvert={ouvert} />
            <span className="min-w-0">
              <span className="block text-[12px] font-semibold uppercase tracking-[0.08em] text-texte-doux group-hover:text-accent">Vie politique</span>
              <span className="block text-[12.5px] leading-snug text-texte-faible">Maire en exercice</span>
              <span className="chiffres block text-[11.5px] text-texte-faible">
                {scrutins.size} scrutin{scrutins.size > 1 ? "s" : ""} · {ouvert ? "replier" : "détail"}
              </span>
            </span>
          </button>
        </th>
        {communes.map((c) => {
          const maire = c.politique.maire;
          // Le RNE ne publie pas de nuance pour les maires : on montre celle de
          // sa liste quand il la conduisait ; sinon, la liste arrivée en tête
          // aux municipales, dite comme telle — jamais attribuée au maire.
          const municipales = c.politique.scrutins.find((s) => s.id === "mun2026");
          const teteMun = municipales ? enTete(municipales) : undefined;
          return (
            <td key={c.codeInsee} className="border-l border-trait/60 py-2.5 pl-3 pr-3 text-right">
              {maire ? (
                <>
                  <span className="block text-[15px] font-semibold leading-snug text-texte">{maire.nom}</span>
                  {maire.nuance ? (
                    <Nuance code={maire.nuance} libelle={maire.nuanceLibelle} />
                  ) : teteMun?.nuance ? (
                    <>
                      <span className="block text-[11.5px] leading-snug text-texte-faible">nuance non publiée · liste en tête aux municipales 2026 :</span>
                      <Nuance code={teteMun.nuance} libelle={teteMun.nuanceLibelle} />
                    </>
                  ) : (
                    <span className="block text-[11.5px] leading-snug text-texte-faible">nuance non publiée</span>
                  )}
                </>
              ) : (
                <span className="text-texte-faible">Maire non renseigné</span>
              )}
            </td>
          );
        })}
      </tr>
      {ouvert && (
        <>
          <tr id="detail-politique" className="border-t border-trait/60 bg-doux/30 align-top">
            <th scope="row" className="sticky left-0 z-10 border-r border-trait/60 bg-carte py-2 pl-7 pr-3 text-left text-[13px] font-normal leading-snug text-texte-doux">
              Maire, nuance de sa liste aux municipales 2026
            </th>
            {communes.map((c) => {
              const m = c.politique.maire;
              return (
                <td key={c.codeInsee} className={cellule}>
                  {m ? (
                    <>
                      <span className="block text-texte">{m.nom}</span>
                      {m.depuis && <span className="chiffres block text-[12px] text-texte-faible">en fonction depuis le {dateCourte(m.depuis)}</span>}
                      {m.nuance ? (
                        <Nuance code={m.nuance} libelle={m.nuanceLibelle} />
                      ) : (
                        <span className="block text-[12px] text-texte-faible">nuance non publiée</span>
                      )}
                    </>
                  ) : (
                    <span className="text-texte-faible">—</span>
                  )}
                </td>
              );
            })}
          </tr>
          {[...scrutins.entries()].map(([id, nom]) => (
            <tr key={id} className="border-t border-trait/60 bg-doux/30 align-top">
              <th scope="row" className="sticky left-0 z-10 border-r border-trait/60 bg-carte py-2 pl-7 pr-3 text-left text-[13px] font-normal leading-snug text-texte-doux">
                {nom}
                <span className="block text-[11.5px] text-texte-faible">liste ou candidat en tête, part des exprimés · participation</span>
              </th>
              {communes.map((c) => {
                const s = c.politique.scrutins.find((x) => x.id === id);
                const tete = s ? enTete(s) : undefined;
                return (
                  <td key={c.codeInsee} className={cellule}>
                    {s && tete ? (
                      <>
                        <span className="block text-texte">{tete.libelle}</span>
                        <Nuance code={tete.nuance} libelle={tete.nuanceLibelle} />
                        <span className="chiffres block text-[12px] text-texte-doux">
                          {nombre(tete.pourcentage, 1)} %
                          {s.participation !== null ? ` · participation ${nombre(s.participation, 1)} %` : ""}
                        </span>
                        {tete.precision && <span className="block text-[11.5px] text-texte-faible">{tete.precision}</span>}
                      </>
                    ) : (
                      <span className="text-texte-faible">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </>
      )}
    </tbody>
  );
}

/** Les sources de chaque critère et des scrutins, dédupliquées sur le nom et le millésime. */
function Sources({ communes }: { communes: Commune[] }) {
  const parGroupe: { id: string; libelle: string; sources: Source[] }[] = CRITERES.map((meta) => {
    const vues = new Map<string, Source>();
    for (const commune of communes) {
      const donnees = commune.criteres[meta.id];
      if (!donnees) continue;
      vues.set(`${donnees.source.nom}|${donnees.source.annee}`, donnees.source);
      for (const m of donnees.mesures) if (m.source) vues.set(`${m.source.nom}|${m.source.annee}`, m.source);
    }
    return { id: meta.id, libelle: meta.libelle, sources: [...vues.values()] };
  });
  const politiques = new Map<string, Source>();
  for (const c of communes) {
    if (c.politique.maire) politiques.set(`${c.politique.maire.source.nom}|${c.politique.maire.source.annee}`, c.politique.maire.source);
    for (const s of c.politique.scrutins) politiques.set(`${s.source.nom}|${s.source.annee}`, s.source);
  }
  parGroupe.push({ id: "politique", libelle: "Vie politique", sources: [...politiques.values()] });
  const retenus = parGroupe.filter((x) => x.sources.length > 0);
  if (retenus.length === 0) return null;
  return (
    <section aria-labelledby="titre-sources-comparaison" className="mt-6">
      <h2 id="titre-sources-comparaison" className="text-[12px] font-semibold uppercase tracking-[0.08em] text-texte-doux">
        Sources
      </h2>
      <ul className="mt-2 space-y-1 text-[12.5px] leading-snug text-texte-doux">
        {retenus.map(({ id, libelle, sources }) => (
          <li key={id}>
            <span className="text-texte">{libelle}</span> —{" "}
            {sources.map((s, i) => (
              <span key={`${s.nom}|${s.annee}`}>
                {i > 0 && " ; "}
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-accent">
                    {s.nomCourt ?? s.nom}
                  </a>
                ) : (
                  s.nomCourt ?? s.nom
                )}
                {` (${s.producteur}, ${s.annee})`}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
