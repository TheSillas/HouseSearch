"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Photos d'une commune, depuis Wikimedia Commons.
 *
 * Pourquoi cette source : des images sous licence libre, avec pour chacune un
 * auteur et une licence qu'on peut afficher — et une résolution par le code
 * INSEE (propriété Wikidata P374) plutôt que par le nom, pour ne jamais
 * confondre deux communes homonymes. Trois requêtes, au moment où une fiche
 * s'ouvre, jamais sur le chemin d'un curseur :
 *
 *  1. Wikidata : l'entité dont le code INSEE est celui de la commune ;
 *  2. Wikidata : son image principale (P18) et sa catégorie Commons (P373) ;
 *  3. Commons : les fichiers de la catégorie, avec vignette, auteur, licence.
 *
 * On écarte ce qui n'est pas une photographie du lieu (blasons, cartes,
 * logos, documents) : la fiche veut montrer la commune, pas ses symboles.
 * Aucune photo trouvée reste « aucune photo », jamais une image d'ailleurs.
 */

export interface Photo {
  id: string;
  vignette: string;
  grande: string;
  page: string;
  auteur: string;
  licence: string;
  licenceUrl?: string;
  description?: string;
}

const LARGEUR_GRANDE = 1280;
const LARGEUR_VIGNETTE = 500;
const MAX_PHOTOS = 10;
const EXCLURE = /blason|armoirie|coat_of_arms|logo|carte|\bmap\b|locat|plan[_ ]|drapeau|flag|panneau|monument aux morts|tampon|timbre|affiche/i;

const cache = new Map<string, Promise<Photo[]>>();

function texteDepuisHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

async function json(url: string): Promise<unknown> {
  const reponse = await fetch(url, { headers: { Accept: "application/json" } });
  if (!reponse.ok) throw new Error(`${reponse.status} ${url}`);
  return reponse.json();
}

interface ImageInfo {
  thumburl?: string;
  url?: string;
  descriptionurl?: string;
  mime?: string;
  extmetadata?: Record<string, { value?: string }>;
}

function versPhoto(titre: string, info: ImageInfo): Photo | null {
  if (!info.thumburl || !info.mime || !/^image\/(jpeg|png|webp)$/.test(info.mime)) return null;
  if (EXCLURE.test(titre)) return null;
  const meta = info.extmetadata ?? {};
  const auteur = meta.Artist?.value ? texteDepuisHtml(meta.Artist.value) : "Auteur non renseigné";
  const licence = meta.LicenseShortName?.value ?? "Licence non renseignée";
  const description = meta.ImageDescription?.value
    ? texteDepuisHtml(meta.ImageDescription.value).slice(0, 160)
    : undefined;
  return {
    id: titre,
    grande: info.thumburl,
    // Pas de largeur dérivée de `thumburl` : le serveur de vignettes n'accepte
    // que certaines largeurs. `Special:FilePath?width=` redirige vers la
    // vignette valide la plus proche, sans seconde requête d'API.
    vignette: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
      titre.replace(/^File:/, ""),
    )}?width=${LARGEUR_VIGNETTE}`,
    page: info.descriptionurl ?? info.url ?? "",
    auteur,
    licence,
    licenceUrl: meta.LicenseUrl?.value,
    description,
  };
}

async function fichiersCommons(params: Record<string, string>): Promise<Photo[]> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  for (const [k, v] of Object.entries({
    action: "query",
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: String(LARGEUR_GRANDE),
    iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl|ImageDescription",
    format: "json",
    origin: "*",
    ...params,
  })) {
    url.searchParams.set(k, v);
  }
  const data = (await json(url.toString())) as {
    query?: { pages?: Record<string, { title: string; imageinfo?: ImageInfo[] }> };
  };
  const pages = Object.values(data.query?.pages ?? {});
  return pages
    .map((p) => (p.imageinfo?.[0] ? versPhoto(p.title, p.imageinfo[0]) : null))
    .filter((p): p is Photo => p !== null);
}

type Claims = Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;

/**
 * Un même code INSEE peut porter plusieurs entités : la commune actuelle et
 * une ancienne commune qui portait ce code avant une fusion. On retient celle
 * qui n'a pas de date de dissolution (P576) — c'est ce qui distingue vraiment
 * la commune d'aujourd'hui, là où le type « commune de France » (P31) est
 * souvent porté par les deux.
 */
async function claimsDeLaCommune(codeInsee: string): Promise<Claims | undefined> {
  const recherche = (await json(
    `https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      `haswbstatement:P374=${codeInsee}`,
    )}&srlimit=5&format=json&origin=*`,
  )) as { query?: { search?: { title: string }[] } };
  const ids = (recherche.query?.search ?? []).map((r) => r.title);
  if (ids.length === 0) return undefined;

  const entites = (await json(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join("|")}&props=claims&format=json&origin=*`,
  )) as { entities?: Record<string, { claims?: Claims }> };
  const candidats = ids.map((id) => entites.entities?.[id]?.claims ?? {});
  const actuelles = candidats.filter((c) => !c.P576);
  return (actuelles.length > 0 ? actuelles : candidats)[0];
}

async function chercherPhotos(codeInsee: string): Promise<Photo[]> {
  const claims = await claimsDeLaCommune(codeInsee);
  if (!claims) return [];
  const imagePrincipale = claims.P18?.[0]?.mainsnak?.datavalue?.value as string | undefined;
  const categorie = claims.P373?.[0]?.mainsnak?.datavalue?.value as string | undefined;

  let photos: Photo[] = [];
  if (categorie) {
    photos = await fichiersCommons({
      generator: "categorymembers",
      gcmtitle: `Category:${categorie}`,
      gcmtype: "file",
      gcmlimit: "40",
    });
  }
  if (imagePrincipale) {
    const titre = `File:${imagePrincipale}`;
    const deja = photos.findIndex((p) => p.id === titre);
    if (deja > 0) photos.unshift(...photos.splice(deja, 1));
    else if (deja === -1) {
      const [principale] = await fichiersCommons({ titles: titre });
      if (principale) photos.unshift(principale);
    }
  }
  return photos.slice(0, MAX_PHOTOS);
}

export function photosDe(codeInsee: string): Promise<Photo[]> {
  let promesse = cache.get(codeInsee);
  if (!promesse) {
    promesse = chercherPhotos(codeInsee).catch((e) => {
      cache.delete(codeInsee);
      throw e;
    });
    cache.set(codeInsee, promesse);
  }
  return promesse;
}

type Etat = { statut: "chargement" } | { statut: "pret"; photos: Photo[] } | { statut: "erreur" };

/**
 * La bande de photos d'une commune ouverte, par-dessus la carte (ou en tête du
 * volet sur téléphone, où la carte est cachée). Un clic ouvre la photo en
 * grand, avec son auteur, sa licence et le lien vers sa page Commons — une
 * image libre se montre avec son crédit, pas sans.
 */
export function PhotosCommune({ codeInsee, nom }: { codeInsee: string; nom: string }) {
  const [etat, setEtat] = useState<Etat>({ statut: "chargement" });
  const [ouverte, setOuverte] = useState<Photo | null>(null);

  useEffect(() => {
    let actif = true;
    setEtat({ statut: "chargement" });
    setOuverte(null);
    photosDe(codeInsee).then(
      (photos) => actif && setEtat({ statut: "pret", photos }),
      () => actif && setEtat({ statut: "erreur" }),
    );
    return () => {
      actif = false;
    };
  }, [codeInsee]);

  // Navigation dans la photo agrandie : la liste est celle de la bande, dans
  // le même ordre, en boucle. Flèches du clavier et boutons latéraux.
  const photos = etat.statut === "pret" ? etat.photos : [];
  const indexOuverte = ouverte ? photos.findIndex((p) => p.id === ouverte.id) : -1;
  const decaler = (pas: number) => {
    if (photos.length < 2 || indexOuverte < 0) return;
    setOuverte(photos[(indexOuverte + pas + photos.length) % photos.length]);
  };

  useEffect(() => {
    if (!ouverte) return;
    // Phase de capture + stopImmediatePropagation : Échap ferme la photo, et
    // seulement elle — pas le volet de fiche derrière, qui écoute aussi.
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setOuverte(null);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (photos.length < 2) return;
        const i = photos.findIndex((p) => p.id === ouverte.id);
        setOuverte(photos[(i + (e.key === "ArrowRight" ? 1 : -1) + photos.length) % photos.length]);
      }
    };
    window.addEventListener("keydown", surTouche, true);
    return () => window.removeEventListener("keydown", surTouche, true);
  }, [ouverte, photos]);

  if (etat.statut === "chargement") {
    return (
      <div className="flex gap-2" aria-busy="true" aria-label={`Recherche de photos de ${nom}`}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[88px] w-[132px] shrink-0 animate-pulse rounded-lg bg-doux/80" />
        ))}
      </div>
    );
  }
  if (etat.statut === "erreur") {
    return (
      <p className="rounded-lg border border-trait bg-carte/90 px-3 py-2 text-[12px] text-texte-faible backdrop-blur">
        Photos indisponibles pour le moment (Wikimedia Commons injoignable).
      </p>
    );
  }
  if (etat.photos.length === 0) {
    return (
      <p className="rounded-lg border border-trait bg-carte/90 px-3 py-2 text-[12px] text-texte-faible backdrop-blur">
        Aucune photo libre de droits trouvée pour {nom} sur Wikimedia Commons.
      </p>
    );
  }

  return (
    <>
      <ul
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
        aria-label={`Photos de ${nom} (Wikimedia Commons)`}
      >
        {etat.photos.map((photo) => (
          <li key={photo.id} className="shrink-0">
            <button
              type="button"
              onClick={() => setOuverte(photo)}
              className="group block h-[88px] w-[132px] overflow-hidden rounded-lg border border-trait bg-doux shadow-flottante transition-transform hover:scale-[1.03] focus-visible:scale-[1.03]"
              aria-label={`Agrandir : ${photo.description ?? photo.id.replace(/^File:/, "")}`}
            >
              {/* Vignettes distantes de Commons, pas d'optimisation Next : la
                  source et la taille sont déjà celles d'une vignette. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.vignette}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          </li>
        ))}
        <li className="flex shrink-0 items-end pb-1 pl-1 text-[10.5px] leading-tight text-texte-faible">
          Wikimedia
          <br />
          Commons
        </li>
      </ul>

      {/* Portail vers <body> : rendue à l'intérieur de la carte, la visionneuse
          resterait dans son contexte d'empilement isolé, sous les badges et
          à côté du panneau ; au niveau racine, elle couvre tout. */}
      {ouverte &&
        createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo de ${nom}`}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4"
          onClick={() => setOuverte(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ouverte.grande}
            alt={ouverte.description ?? `Photo de ${nom}`}
            className="max-h-[78vh] max-w-full rounded-lg object-contain shadow-flottante"
            onClick={(e) => e.stopPropagation()}
          />
          <p
            className="mt-3 max-w-[720px] text-center text-[12.5px] leading-snug text-white/85"
            onClick={(e) => e.stopPropagation()}
          >
            {photos.length > 1 && (
              <span className="chiffres block text-white/70">
                {indexOuverte + 1} / {photos.length}
              </span>
            )}
            {ouverte.description && <span className="block text-white">{ouverte.description}</span>}
            <span>
              {ouverte.auteur} ·{" "}
              {ouverte.licenceUrl ? (
                <a
                  href={ouverte.licenceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline underline-offset-2"
                >
                  {ouverte.licence}
                </a>
              ) : (
                ouverte.licence
              )}{" "}
              ·{" "}
              <a
                href={ouverte.page}
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2"
              >
                Wikimedia Commons
              </a>
            </span>
          </p>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  decaler(-1);
                }}
                aria-label="Photo précédente"
                className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-6"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="m12 4-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  decaler(1);
                }}
                aria-label="Photo suivante"
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-6"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="m8 4 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setOuverte(null)}
            aria-label="Fermer la photo"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>,
          document.body,
        )}
    </>
  );
}
