import { readFileSync } from "node:fs";

import { chargerNoyau, cheminNoyauGz } from "@/lib/regions";

/**
 * Le noyau national (toutes les communes, mesures du classement) servi au
 * navigateur comme une ressource à part, pré-compressée à la construction du
 * jeu de données et mise en cache sans limite sous une URL qui porte son
 * empreinte. La page d'accueil, elle, n'embarque qu'un aperçu (voir apercu.ts) :
 * elle s'affiche tout de suite, et le noyau — 1 Mo compressé, une seule fois
 * par navigateur — arrive à côté pour rendre les curseurs vivants.
 */
export const dynamic = "force-static";

let gzMemo: { empreinte: string; octets: Buffer } | null = null;

export async function GET(_requete: Request, contexte: { params: Promise<{ empreinte: string }> }) {
  const { empreinte } = await contexte.params;
  const noyau = chargerNoyau();
  if (empreinte !== noyau.empreinte) return new Response("Version inconnue du noyau", { status: 404 });
  if (gzMemo?.empreinte !== empreinte) {
    gzMemo = { empreinte, octets: readFileSync(cheminNoyauGz()) };
  }
  return new Response(new Uint8Array(gzMemo.octets), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-encoding": "gzip",
      "cache-control": "public, max-age=31536000, immutable",
      vary: "accept-encoding",
    },
  });
}
