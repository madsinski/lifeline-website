# -*- coding: utf-8 -*-
"""Derive ingredient lines for the snacks whose name is the recipe.

Faithful, not inventive: every line comes from words already in the name.
Where the name states an amount ("6 möndlur", "100 g", "2 msk.") the amount
is kept and moved to the front so the shopping list can parse it. Where the
name states no amount, the line is the bare food — the list shows
unquantified items verbatim, which is honest, and a quantity I made up
would be worse than none.
"""
import json, os, re, sys, urllib.request

token = open(os.path.expanduser("~/.supabase/access-token")).read().strip()

def sql(q):
    req = urllib.request.Request(
        "https://api.supabase.com/v1/projects/cfnibfxzltxiriqxvvru/database/query",
        data=json.dumps({"query": q}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST")
    return json.loads(urllib.request.urlopen(req, timeout=120).read())

# "Köld kjúklingabringa, 100 g" → amount after the comma.
TRAILING_AMOUNT = re.compile(r"^(.*?),\s*((?:\d+[.,]?\d*|½|¼|¾)\s*(?:g|kg|ml|dl|msk\.?|tsk\.?|sneiðar|sneið|poki|skeið|skeiðar))\s*(\(.*\))?$", re.I)
# "Kotasæla, 225 g (1%)" → keep the parenthetical.
TRAILING_NOTE = re.compile(r"^(.*?),\s*([^,()]+?)\s*(\(.*\))?$")
LEADING_AMOUNT = re.compile(r"^(?:\d+[.,]?\d*|½|¼|¾)\s")

# Names the generic rules get wrong, corrected by hand.
#
# Each of these is a judgement the rules cannot make: a spelled-out numeral
# the shopping list cannot add up, a parenthetical that belongs to the whole
# drink rather than to the fruit, a scoop that is of powder rather than of
# the shake it becomes, or a composite that is two things to buy. Written
# out rather than inferred, so each one can be argued with.
OVERRIDES: dict[str, list[str]] = {
    # Spelled-out numerals, so eggs add up with other egg lines.
    "Þrjú harðsoðin egg": ["3 harðsoðin egg"],
    "Tvö harðsoðin egg": ["2 harðsoðin egg"],
    "Harðsoðið egg": ["1 harðsoðið egg"],
    # "(vatn)" is what the shake is made with, not a property of the banana.
    "Mysuprótein + banani (vatn)": ["1 skeið mysuprótein", "1 banani", "vatn"],
    # The scoop is of powder; the hristingur is the result.
    "Próteinhristingur, 1 skeið (mjólk)": ["1 skeið próteinduft", "2,5 dl mjólk"],
    "Próteinhristingur, 1 skeið (vatn)": ["1 skeið próteinduft", "vatn"],
    "Próteinhristingur, 2 skeiðar (mjólk)": ["2 skeiðar próteinduft", "2,5 dl mjólk"],
    # Two things to buy, not one.
    "Ristað brauð með hnetusmjöri, 2 sneiðar": ["2 sneiðar brauð", "hnetusmjör"],
    "Túnfiskur á ristuðu brauði": ["1 dós túnfiskur", "2 sneiðar brauð"],
    "Túnfisksamloka": ["1 dós túnfiskur", "2 sneiðar brauð"],
    "Hummus + hálft pítubrauð": ["hummus", "1 pítubrauð"],
    "Granólaskál með próteini": ["granóla", "1 skeið próteinduft", "mjólk"],
    "Próteinþeytingur með banana": ["1 skeið próteinduft", "1 banani", "mjólk"],
    # Singular items worth a count, so they merge across days.
    "Ostastöng": ["1 ostastöng"],
    "Hrískaka + hnetusmjör": ["1 hrískaka", "hnetusmjör"],
    "Epli + 6 möndlur": ["1 epli", "6 möndlur"],
    "Epli + hnetusmjör": ["1 epli", "hnetusmjör"],
    "Banani + hnetusmjör": ["1 banani", "hnetusmjör"],
    "Kotasæla + ferskja": ["kotasæla", "1 ferskja"],
    # Countable singles get a count, so two of them across the week add up.
    # The staples below them deliberately do not: you buy a tub of cottage
    # cheese and a jar of peanut butter, not 40 g of either.
    "Próteinstykki, venjulegt": ["1 próteinstykki (venjulegt)"],
    "Próteinstykki, lítið": ["1 próteinstykki (lítið)"],
    "Próteinstykki, XL": ["1 próteinstykki (XL)"],
    "Túnfiskur í poka, hálfur": ["½ poki túnfiskur"],
    "Túnfiskur í poka, heill": ["1 poki túnfiskur"],
}


def derive(name: str) -> list[str]:
    if name in OVERRIDES:
        return OVERRIDES[name]
    out: list[str] = []
    for part in [p.strip() for p in name.split("+") if p.strip()]:
        m = TRAILING_AMOUNT.match(part)
        if m:
            food, amount, note = m.group(1).strip(), m.group(2).strip(), (m.group(3) or "").strip()
            out.append(" ".join(x for x in [amount, food.lower(), note] if x))
            continue
        m = TRAILING_NOTE.match(part)
        if m and not LEADING_AMOUNT.match(part):
            food, qual, note = m.group(1).strip(), m.group(2).strip(), (m.group(3) or "").strip()
            # "Próteinstykki, venjulegt" — a size, not an amount.
            out.append(" ".join(x for x in [food.lower(), f"({qual})" if qual else "", note] if x))
            continue
        out.append(part if LEADING_AMOUNT.match(part) else part.lower())
    return out

rows = sql("""select id, name_is, name from meals
where retired = false and coalesce(cardinality(ingredients_is), 0) = 0
order by name;""")

plan = []
for r in rows:
    nm = r["name_is"] or r["name"]
    plan.append({"id": r["id"], "name": nm, "lines": derive(nm)})

for p in plan:
    print(f"  {p['name'][:42]:<42} → {p['lines']}")
print(f"\n{len(plan)} meals, {sum(len(p['lines']) for p in plan)} lines derived")
json.dump(plan, open("derived.json", "w"), ensure_ascii=False, indent=1)

# ── Run notes, 2026-10-12 ────────────────────────────────────────────────
#
# Applied to all 40 meals that had no Icelandic ingredient lines. Every
# non-retired meal (156) now has them.
#
# READ THIS BEFORE BELIEVING THE ABOVE MATTERS. All 40 are is_filler = true,
# and is_filler is read in exactly two places — compose.ts:117 and
# api/hc/library/route.ts:39 — both of which EXCLUDE it. Nothing reads
# fillers positively. So these 40 can never be offered in the swap library,
# never composed into a plan, and never reach a shopping list. The change is
# harmless and makes the rows coherent if fillers are ever switched on, but
# it fixes nothing a user can see today.
#
# The empty ingredients_is and the is_filler flag were the same fact: these
# are macro-only gap entries, not recipes. I found the empty arrays by
# querying cardinality(ingredients_is) = 0 without also checking is_filler,
# and reported "40 untranslated meal ingredient lists" as a live gap. They
# were never untranslated either — they are Icelandic already, with no
# structured ingredients because the name was the whole recipe.
#
# The real state: the 116 meals the app actually serves all had Icelandic
# ingredient lines before this ran, which is why the shopping list already
# read cleanly.
#
# The open question is a product one, for Mads: retire these 40 outright, or
# switch fillers on so a snack can be planned. Either is a decision; this
# script is not.
#
# fibre_g is deliberately NOT recomputed from these lines. It is already set
# for them from a better source, and 25% of all ingredient lines are
# unquantified staples — "hnetusmjör", "kotasæla" — which is right for a
# shopping list and useless for macros. scripts/meal-fibre.py stays the only
# thing that writes fibre.
