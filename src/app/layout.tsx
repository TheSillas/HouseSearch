import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--police-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Où Vivre — comparateur de communes sur données publiques",
    template: "%s — Où Vivre",
  },
  description:
    "Réglez l'importance du prix de l'immobilier, de la sécurité, des écoles et des transports : le classement des communes se recalcule en direct, sur des données publiques sourcées.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#131211" },
  ],
};

/**
 * Racine commune à deux gabarits qui n'ont rien d'autre en partage :
 *
 *  - « (carte) » : la page d'accueil est une application plein écran — la
 *    carte occupe tout, les réglages et le classement vivent dans un panneau
 *    accolé, rien ne défile hors des listes ;
 *  - « (site) » : fiches et méthode sont des pages à lire, dans une colonne
 *    de lecture avec en-tête et pied de page (voir ChromeSite).
 *
 * Ne vit ici que ce que les deux partagent : la police, le thème, le lien
 * d'évitement.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="min-h-dvh antialiased">
        {/* Développement seulement. React 19 journalise chaque rendu dans le
            panneau Performance en comparant les anciennes et les nouvelles
            props objet par objet : avec 34 746 communes, choisir un repère
            figeait la page une minute. Sans `console.timeStamp`, React désactive
            cette journalisation. La production n'embarque rien de ceci. */}
        {process.env.NODE_ENV === "development" && (
          <script dangerouslySetInnerHTML={{ __html: "console.timeStamp = undefined;" }} />
        )}
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-carte focus:px-4 focus:py-2 focus:shadow-flottante"
        >
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
