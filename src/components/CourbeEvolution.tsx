"use client";

import { useId, useRef, useState } from "react";

import { chemin, cheminAire, construireEchelle, pointLePlusProche } from "@/lib/courbe";
import { nombre } from "@/lib/format";
import type { PointHistorique } from "@/lib/types";

const LARGEUR = 320;
const HAUTEUR = 132;
const MARGE = { haut: 22, bas: 20, gauche: 4, droite: 4 };

function formater(valeur: number, decimales: number, unite: string): string {
  const n = nombre(valeur, decimales);
  return unite ? `${n} ${unite}` : n;
}

/**
 * Courbe d'évolution d'une mesure sur plusieurs années.
 *
 * Un seul tracé, donc une seule couleur (l'accent du produit) : pas de légende
 * à construire, le libellé de la mesure au-dessus du graphique dit déjà ce qui
 * est montré. Une valeur manquante casse la ligne plutôt que d'être comblée
 * par une interpolation — ce serait montrer une trajectoire inventée.
 */
export function CourbeEvolution({
  points,
  unite,
  decimales = 0,
  libelle,
}: {
  points: PointHistorique[];
  unite: string;
  decimales?: number;
  libelle: string;
}) {
  const echelle = construireEchelle(points, LARGEUR, HAUTEUR, MARGE);
  const [survole, setSurvole] = useState<number | null>(null);
  const zoneRef = useRef<SVGRectElement>(null);
  const idDegrade = useId();

  if (!echelle) return null;

  const { segments, points: traces, yBase, indexMin, indexMax, indexFin } = echelle;
  const pointFin = traces[indexFin];
  const pointMin = traces[indexMin];
  const pointMax = traces[indexMax];
  const pointSurvole = survole !== null ? traces[survole] : null;

  // Le point mis en avant hors survol : la dernière valeur connue, la « valeur
  // actuelle » de la mesure. Si son extrême (min ou max) est un autre point de
  // la série, on l'étiquette aussi, pour ne pas laisser un pic ou un creux muet.
  const finEstExtreme = indexFin === indexMin || indexFin === indexMax;
  const extremeSecondaire = !finEstExtreme
    ? indexMax !== indexFin
      ? { point: pointMax, cote: "haut" as const }
      : { point: pointMin, cote: "bas" as const }
    : null;

  function gererPointeur(e: React.PointerEvent<SVGRectElement>) {
    const zone = zoneRef.current;
    if (!zone) return;
    const rect = zone.getBoundingClientRect();
    const xSvg = ((e.clientX - rect.left) / rect.width) * LARGEUR;
    const proche = pointLePlusProche(traces, xSvg);
    setSurvole(proche?.index ?? null);
  }

  const yLabel = (p: { y: number }, prefereHaut: boolean) =>
    prefereHaut ? Math.max(p.y - 8, 10) : Math.min(p.y + 16, HAUTEUR - MARGE.bas + 14);

  return (
    <div className="relative mt-1">
      <svg
        viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
        className="block w-full text-accent"
        role="img"
        aria-label={`Évolution de ${libelle} de ${points[0].annee} à ${points[points.length - 1].annee}`}
      >
        <defs>
          <linearGradient id={idDegrade} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.16} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Ligne de base, hairline recessive : cadre le bas de la zone tracée. */}
        <line
          x1={MARGE.gauche}
          y1={yBase}
          x2={LARGEUR - MARGE.droite}
          y2={yBase}
          className="text-trait"
          stroke="currentColor"
          strokeWidth={1}
        />

        {segments.map((segment, i) => (
          <g key={i}>
            <path d={cheminAire(segment, yBase)} fill={`url(#${idDegrade})`} />
            <path
              d={chemin(segment)}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}

        {/* Repère vertical au survol, et anneau de surface autour du point ciblé. */}
        {pointSurvole && (
          <line
            x1={pointSurvole.x}
            y1={MARGE.haut - 6}
            x2={pointSurvole.x}
            y2={yBase}
            className="text-trait-fort"
            stroke="currentColor"
            strokeWidth={1}
          />
        )}

        {extremeSecondaire?.point && (
          <circle cx={extremeSecondaire.point.x} cy={extremeSecondaire.point.y} r={3} fill="currentColor" />
        )}

        {pointFin && (
          <circle
            cx={pointFin.x}
            cy={pointFin.y}
            r={survole === indexFin ? 5 : 4}
            fill="currentColor"
            stroke="var(--fond-carte)"
            strokeWidth={2}
            style={{ transition: "r 120ms ease" }}
          />
        )}

        {pointSurvole && survole !== indexFin && (
          <circle
            cx={pointSurvole.x}
            cy={pointSurvole.y}
            r={5}
            fill="currentColor"
            stroke="var(--fond-carte)"
            strokeWidth={2}
          />
        )}

        {/* Texte hors zone colorée : jamais la couleur de la série sur du texte. */}
        <g className="text-texte fill-current text-[10.5px] font-medium">
          {pointFin && (
            <text
              x={Math.min(pointFin.x, LARGEUR - MARGE.droite - 2)}
              y={yLabel(pointFin, pointFin.y > HAUTEUR / 2)}
              textAnchor={pointFin.x > LARGEUR - 40 ? "end" : "middle"}
            >
              {formater(pointFin.valeur, decimales, unite)}
            </text>
          )}
        </g>
        {extremeSecondaire?.point && (
          <g className="text-texte-faible fill-current text-[10px]">
            <text
              x={extremeSecondaire.point.x}
              y={yLabel(extremeSecondaire.point, extremeSecondaire.cote === "haut")}
              textAnchor={
                extremeSecondaire.point.x < 24
                  ? "start"
                  : extremeSecondaire.point.x > LARGEUR - 24
                    ? "end"
                    : "middle"
              }
            >
              {formater(extremeSecondaire.point.valeur, decimales, unite)}
            </text>
          </g>
        )}

        <g className="text-texte-faible fill-current text-[10px]">
          <text x={MARGE.gauche} y={HAUTEUR - 4} textAnchor="start">
            {points[0].annee}
          </text>
          <text x={LARGEUR - MARGE.droite} y={HAUTEUR - 4} textAnchor="end">
            {points[points.length - 1].annee}
          </text>
        </g>

        {/* Zone de survol : toute la largeur, pour que le pointeur n'ait jamais
            à viser une ligne de 2 px. */}
        <rect
          ref={zoneRef}
          x={0}
          y={0}
          width={LARGEUR}
          height={HAUTEUR}
          fill="transparent"
          onPointerMove={gererPointeur}
          onPointerLeave={() => setSurvole(null)}
        />
      </svg>

      {pointSurvole && (() => {
        // Sous le point quand il n'y a pas assez de place au-dessus (le pic de
        // la courbe, typiquement) : sans ce repli, l'infobulle déborderait sur
        // le texte qui précède le graphique.
        const enBas = pointSurvole.y < 44;
        return (
          <div
            className="pointer-events-none absolute rounded-lg border border-trait bg-carte px-2.5 py-1.5 text-[12px] shadow-flottante"
            style={{
              left: `${(pointSurvole.x / LARGEUR) * 100}%`,
              top: `${(pointSurvole.y / HAUTEUR) * 100}%`,
              transform: `translate(${
                pointSurvole.x < LARGEUR / 2 ? "-4px" : "calc(-100% + 4px)"
              }, ${enBas ? "10px" : "calc(-100% - 10px)"})`,
            }}
          >
            <div className="chiffres font-semibold">{formater(pointSurvole.valeur, decimales, unite)}</div>
            <div className="text-texte-faible">{pointSurvole.annee}</div>
          </div>
        );
      })()}

      {/* Chaque valeur reste accessible sans survol : lecteur d'écran ou clavier. */}
      <table className="sr-only">
        <caption>{`Évolution de ${libelle}, une valeur par année`}</caption>
        <thead>
          <tr>
            <th scope="col">Année</th>
            <th scope="col">Valeur</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.annee}>
              <td>{p.annee}</td>
              <td>{p.valeur === null ? "non disponible" : formater(p.valeur, decimales, unite)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
