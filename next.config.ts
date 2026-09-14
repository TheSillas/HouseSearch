import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `src/lib/regions.ts` ouvre `data/dist/<département>.json.gz` par un chemin
   * calculé à l'exécution : le traçage de fichiers de Next ne peut pas le
   * déduire du code, et les fiches de commune renverraient un ENOENT une fois
   * déployées. On déclare donc le jeu à la main.
   *
   * Le jeu compressé entier pèse 33 Mo — loin du plafond de 250 Mo par
   * fonction — et la fiche d'une commune est atteignable aussi bien par son
   * URL propre (`/ville/[slug]`) que par la route interceptée du volet, sous
   * l'arbre de la carte. Plutôt que de deviner quelles clés de route couvrent
   * l'interception, on le joint partout : le coût est en octets déployés, pas
   * en travail à l'exécution — un département n'est décompressé que lorsqu'une
   * fiche le demande.
   */
  outputFileTracingIncludes: {
    "/**": ["./data/dist/*.json.gz"],
  },
};

export default nextConfig;
