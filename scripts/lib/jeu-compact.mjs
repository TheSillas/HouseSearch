/**
 * Dilatation du format compact (version 2) écrit par build-dataset.mjs en
 * communes complètes, telles que l'application les manipule. Miroir exact de
 * `src/lib/jeu-compact.ts` : les deux doivent produire les mêmes objets, ce que
 * vérifie `src/lib/artefact.test.ts`.
 */
export function dilater(jeu) {
  if (jeu.version !== 2) throw new Error(`Format de jeu inattendu (version ${jeu.version})`);
  return jeu.communes.map((c) => {
    const criteres = {};
    for (const [id, entree] of Object.entries(c.criteres)) {
      const dico = jeu.criteres[id];
      const absentes = new Set(entree.absentes ?? []);
      const mesures = [];
      dico.mesures.forEach((meta, i) => {
        if (absentes.has(i)) return;
        const { sourceRef, ...reste } = meta;
        const m = { ...reste, valeur: entree.v[i] };
        if (sourceRef !== undefined) m.source = jeu.sources[sourceRef];
        for (const [champ, valeur] of Object.entries(entree.x?.[i] ?? {})) {
          if (valeur === null && champ !== "valeur") delete m[champ];
          else m[champ] = valeur;
        }
        mesures.push(m);
      });
      criteres[id] = {
        mesures,
        source: entree.t?.source ?? dico.source,
        methodologie: entree.t?.methodologie ?? dico.methodologie,
        caveats: entree.t?.caveats ?? dico.caveats,
      };
    }
    return { ...c, criteres };
  });
}
