import { describe, expect, it } from "vitest";

import { decoderSlugs, lienComparaison, plusFavorables } from "./comparaison";

describe("comparaison côte à côte", () => {
  it("lit les slugs de l'URL, dédoublonnés et bornés à six", () => {
    expect(decoderSlugs("biarritz,anglet")).toEqual(["biarritz", "anglet"]);
    expect(decoderSlugs("biarritz, anglet ,biarritz")).toEqual(["biarritz", "anglet"]);
    expect(decoderSlugs("a,b,c,d,e,f,g")).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(decoderSlugs("biarritz,<script>")).toEqual(["biarritz"]);
    expect(decoderSlugs(undefined)).toEqual([]);
    expect(decoderSlugs(["a", "b"])).toEqual([]);
  });

  it("construit un lien partageable", () => {
    expect(lienComparaison(["biarritz", "anglet"])).toBe("/comparer?communes=biarritz,anglet");
    expect(lienComparaison(["a", "a"])).toBe("/comparer?communes=a");
    expect(lienComparaison([])).toBe("/comparer");
  });

  it("marque les valeurs les plus favorables selon le sens, ex-æquo compris", () => {
    expect(plusFavorables([3200, 1800, null, 1800], "bas")).toEqual([false, true, false, true]);
    expect(plusFavorables([88, 92.5, 70], "haut")).toEqual([false, true, false]);
    expect(plusFavorables([5, null], "bas")).toEqual([false, false]);
    expect(plusFavorables([null, null], "haut")).toEqual([false, false]);
  });
});
