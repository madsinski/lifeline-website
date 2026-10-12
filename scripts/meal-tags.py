# -*- coding: utf-8 -*-
"""Derive dietary_tags for the meal library.

Usage: python3 -I scripts/meal-tags.py [--write]

Why this exists
---------------
A diet in this system is an ALLOWLIST: mealAllowed() requires a meal to
carry the "gluten-free" tag before it is served to somebody who asked for
gluten-free. The curated Lifeline list arrived with no dietary_tags, so
every meal failed that test and the Næring page showed "Engin máltíð" in
every slot for anybody with a diet preference. That is what this fixes.

How the diet tags are decided
-----------------------------
By reading the ingredients against the SAME word lists the allergen filter
already uses in src/lib/hc/nutrition.ts, copied here verbatim rather than
re-invented. Those lists are bilingual and already reviewed, and the one
property that matters is inherited with them: they fail safe. A word that
might mean the thing is present counts as present, so a meal is only
labelled free of something when nothing in it suggests otherwise.

Over-excluding costs somebody a dinner suggestion. Under-excluding puts
wheat in front of a coeliac. Note that the gluten list counts oats, which
is the conservative reading — uncertified oats carry gluten.

None of this is a safety guarantee and the UI does not claim one: the
ingredient lists are a content library, not a manufacturer's declaration.

Meat has no list in nutrition.ts because it is not an allergen, so one is
defined here for the vegetarian and vegan tags, on the same fail-safe
footing.

The macro tags
--------------
high-protein and low-carb are thresholds on the stored macros, not
judgements: the programme RULES in meals.ts rank by them, so they need to
mean the same thing for every row. protein-shake is read off the name
because two programmes avoid it.
"""
import json
import os
import sys
import urllib.request

# ── Copied verbatim from src/lib/hc/nutrition.ts ALLERGEN_OPTIONS ──────────
GLUTEN = ["hveiti", "brauð", "pasta", "núðlur", "kúskús", "bygg", "rúgur", "rúgbrauð",
          "hafrar", "haframjöl", "hrökkbrauð", "tortilla", "vefja", "semolina", "bulgur",
          "wheat", "bread", "noodle", "couscous", "barley", "rye", "oat", "cracker",
          "flour", "panko", "soy sauce", "sojasósa"]
MILK = ["mjólk", "rjómi", "rjóma", "smjör", "ostur", "ost", "skyr", "jógúrt", "kotasæla",
        "mysa", "milk", "cream", "butter", "cheese", "yogurt", "yoghurt", "cottage",
        "whey", "ghee"]
EGG = ["egg", "eggja", "majónes", "mayonnaise", "aioli", "omelette", "ommelett"]
FISH = ["fiskur", "fisk", "lax", "laxi", "þorskur", "þorsk", "ýsa", "ýsu", "silungur",
        "silung", "túnfiskur", "túnfisk", "sardín", "ansjósu", "fish", "salmon", "cod",
        "haddock", "trout", "tuna", "sardine", "anchov", "fish sauce"]
SHELLFISH = ["rækja", "rækjur", "humar", "krabbi", "krabba", "shrimp", "prawn",
             "lobster", "crab", "langoustine"]
MOLLUSC = ["kræklingur", "kræklinga", "hörpuskel", "smokkfisk", "mussel", "scallop",
           "squid", "calamari", "oyster"]

# ── Not an allergen, so it has no list there. Same fail-safe footing. ─────
MEAT = ["kjúkling", "kjúklingur", "nautakjöt", "nautahakk", "hakk", "lamb", "lambakjöt",
        "svínakjöt", "skinka", "beikon", "pylsa", "pepperoni", "salami", "kalkún",
        "kalkúna", "hangikjöt", "harðfiskur", "lifur", "chicken", "beef", "mince",
        "pork", "ham", "bacon", "sausage", "turkey", "steak", "lamb", "jerky",
        "chorizo", "prosciutto", "meat"]
SHAKE = ["shake", "þeyting", "hristing", "smoothie", "whey", "mysuprótein", "casein"]

HIGH_PROTEIN_G = 25
LOW_CARB_G = 20


def has(text: str, words) -> bool:
    return any(w in text for w in words)


def tags_for(m: dict) -> list:
    """The tags a meal earns, from its own ingredients and macros."""
    hay = " ".join([
        (m.get("name") or ""), (m.get("name_is") or ""),
        " ".join(m.get("ingredients") or []), " ".join(m.get("ingredients_is") or []),
    ]).lower()

    out = []
    # Diet allowlist tags: only when nothing suggests the thing is present.
    if not has(hay, GLUTEN):
        out.append("gluten-free")
    if not has(hay, MILK):
        out.append("dairy-free")
    animal = has(hay, MEAT) or has(hay, FISH) or has(hay, SHELLFISH) or has(hay, MOLLUSC)
    if not animal:
        out.append("vegetarian")
        if not has(hay, MILK) and not has(hay, EGG):
            out.append("vegan")

    # Macro tags, as thresholds so they mean one thing across the library.
    protein = m.get("protein")
    carbs = m.get("carbs")
    if protein is not None and float(protein) >= HIGH_PROTEIN_G:
        out.append("high-protein")
    if carbs is not None and float(carbs) <= LOW_CARB_G:
        out.append("low-carb")

    # Two programmes avoid these by name.
    if has(hay, SHAKE):
        out.append("protein-shake")

    # Kept from the import: the cooking-preference filter matches on it.
    for keep in ("meal-prep", "freezer", "box", "wrap", "weekday-only"):
        if keep in (m.get("dietary_tags") or []):
            out.append(keep)

    return sorted(set(out))


def sql(query: str):
    token = open(os.path.expanduser("~/.supabase/access-token")).read().strip()
    req = urllib.request.Request(
        "https://api.supabase.com/v1/projects/cfnibfxzltxiriqxvvru/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST")
    return json.loads(urllib.request.urlopen(req, timeout=180).read())


def main():
    write = "--write" in sys.argv
    rows = sql("""select id, name, name_is, ingredients, ingredients_is, protein, carbs,
                  dietary_tags, category from meals where retired = false;""")
    print(f"live meals: {len(rows)}")

    counts = {}
    updates = []
    for m in rows:
        t = tags_for(m)
        for x in t:
            counts[x] = counts.get(x, 0) + 1
        updates.append((m["id"], t))

    print("\ntags earned:")
    for k, n in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"   {k:<15} {n:>3}  ({round(n / len(rows) * 100)}%)")

    none = [m for m, t in zip(rows, [u[1] for u in updates]) if not t]
    if none:
        print(f"\n{len(none)} meals earned no tag at all:")
        for m in none[:6]:
            print(f"   {str(m.get('name_is') or m['name'])[:44]}")

    if not write:
        print("\nreport only — pass --write to update dietary_tags")
        return

    # One statement, so the library is never half-tagged.
    vals = ",\n  ".join(
        f"('{mid}'::uuid, array[{', '.join(chr(39) + x + chr(39) for x in t)}]::text[])"
        if t else f"('{mid}'::uuid, '{{}}'::text[])"
        for mid, t in updates)
    sql(f"""with t(id, tags) as (values {vals})
            update meals m set dietary_tags = t.tags from t where m.id = t.id;""")
    print(f"\nwrote dietary_tags for {len(updates)} meals")


if __name__ == "__main__":
    main()
