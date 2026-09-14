import Link from "next/link";

export function Introuvable() {
  return (
    <div className="py-16">
      <h1 className="text-[26px] font-semibold tracking-tight">Page introuvable</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-texte-doux">
        Cette commune ne fait pas partie du jeu de données, ou l&apos;adresse est incorrecte.
      </p>
      <Link
        href="/"
        className="mt-5 inline-block rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-white"
      >
        Revenir au classement
      </Link>
    </div>
  );
}
