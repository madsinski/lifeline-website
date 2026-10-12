#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Estimate dietary fibre per serving for the meal library.

Why this exists
---------------
The Prógrammið sleeve reports the week's macros against a target. It could
not report fibre, because `meals` had protein, carbs and fat on all 164 rows
and no fibre at all. A 0 g bar against a 25-35 g target would have told every
participant their plan fails on fibre -- a claim about their food we cannot
make -- so the sleeve said fibre was missing instead.

How it works
------------
Arithmetic over a documented table, not a guess. Each ingredient line is
parsed into (quantity, unit, food), the food is matched against FIBRE_PER_100G
below, and the grams of fibre are summed for the serving the recipe makes.
The script lives in the repo, so every number in the column can be recomputed
and argued with.

Coverage, and why it matters
---------------------------
Animal products, oils and plain dairy are *known zeros*: chicken contributes
no fibre, and that is a fact rather than a gap. They count as identified, so a
chicken-and-rice dish is fully determined. What leaves a row NULL is an
ingredient the table does not recognise, in enough quantity to matter.

Rows below MIN_COVERAGE are left NULL rather than written with a number
nobody should rely on.

Sources: the per-100 g values are the standard composition figures for these
foods (USDA SR/FDC entries for the generic form of each). They are recipe
estimates, like the macros beside them -- not a laboratory assay, and nothing
should present them as one.

Usage:  python3 scripts/meal-fibre.py          # report only
        python3 scripts/meal-fibre.py --write  # update the meals table
"""

import json
import os
import re
import sys
import urllib.request

MIN_COVERAGE = 0.80

# ── Fibre, grams per 100 g of the food as the recipe uses it ──────────────
# "dry" where a recipe weighs the uncooked grain or pulse, because that is
# how these recipes are written.
FIBRE_PER_100G = {
    # Grains, flours, breads
    "rolled oats": 10.1, "oats": 10.1, "oatmeal": 10.1, "porridge oats": 10.1,
    "quinoa": 7.0, "bulgur": 12.5, "couscous": 5.0,
    "brown rice": 3.5, "white rice": 1.3, "rice": 1.3, "basmati rice": 1.3,
    "pasta": 3.2, "wholewheat pasta": 10.0, "whole wheat pasta": 10.0,
    "spaghetti": 3.2, "noodles": 2.0, "rice noodles": 1.0,
    "rye bread": 5.8, "wholemeal bread": 7.0, "whole wheat bread": 7.0,
    "sourdough bread": 2.9, "bread": 2.7, "toast": 2.7,
    "bagel": 2.6, "wholemeal bagel": 7.0, "whole wheat bagel": 7.0,
    "tortilla": 3.0, "wholemeal tortilla": 6.0, "whole wheat tortilla": 6.0,
    "pita": 2.7, "wrap": 3.0, "granola": 8.0, "muesli": 7.6,
    "flour": 2.7, "wholemeal flour": 10.7, "breadcrumbs": 4.5,
    "crispbread": 16.0, "rice cakes": 1.5, "flatbread": 3.0,
    # Brewed drinks: known zeros. Coffee carries no meaningful dietary
    # fibre, and leaving it unrecognised sent every coffee entry to NULL on
    # coverage alone.
    "black coffee": 0.0, "coffee": 0.0, "brewed black coffee": 0.0,
    "freshly brewed black coffee": 0.0, "cold brew": 0.0, "espresso": 0.0,
    "americano": 0.0,
    # Icelandic names that appear inside an otherwise English list, because
    # the curated list names Icelandic products as they are sold here.
    # kotasæla is cottage cheese, a dairy zero; rófur is swede.
    "kotasæla": 0.0, "rófur": 2.3, "rofur": 2.3,
    # Yogurt and cucumber, so near enough nothing.
    "tzatziki": 0.6,
    # Nixtamalised corn flour.
    "masa harina": 6.0,
    # Fish, shellfish and dried fish: known zeros, named as the curated list
    # names them. harðfiskur and rækjur are sold under those names here.
    "arctic char": 0.0, "arctic char fillets": 0.0, "char": 0.0,
    "harðfiskur": 0.0, "hardfiskur": 0.0,
    "rækjur": 0.0, "raekjur": 0.0, "shrimp": 0.0, "prawns": 0.0,
    # Whey is a protein isolate — no fibre.
    "whey": 0.0, "whey shake": 0.0, "whey protein": 0.0,
    # Icelandic barley, cooked. Dry bygg is far higher; the list measures it
    # cooked, which is where the water has gone in.
    "barley": 3.8, "bygg": 3.8, "pearl barley": 3.8, "cooked barley": 3.8,
    "cooked icelandic barley": 3.8,
    # Mixed roasted root vegetables, and sourdough by another name.
    "roasted roots": 2.5, "roots": 2.5, "root vegetables": 2.5,
    "day-old sourdough": 2.9,
    "dried cranberries": 5.7, "cranberries": 3.6,
    # Pulses
    "lentils": 7.9, "red lentils": 7.9, "green lentils": 7.9,
    "chickpeas": 7.6, "black beans": 8.7, "kidney beans": 7.4,
    "beans": 7.0, "butter beans": 7.0, "edamame": 5.2, "peas": 5.7,
    "baked beans": 4.6, "hummus": 6.0, "tofu": 2.3, "tempeh": 4.8,
    # Vegetables
    "onion": 1.7, "red onion": 1.7, "spring onion": 2.6, "shallot": 3.2,
    "garlic": 2.1, "tomato": 1.2, "tomatoes": 1.2, "cherry tomatoes": 1.2,
    "chopped tomatoes": 1.2, "passata": 1.4, "tomato puree": 3.0,
    "bell pepper": 1.7, "pepper": 1.7, "red pepper": 1.7,
    "carrot": 2.8, "carrots": 2.8, "broccoli": 2.6, "cauliflower": 2.0,
    "spinach": 2.2, "kale": 3.6, "rocket": 1.6, "lettuce": 1.3,
    "mixed greens": 1.8, "salad": 1.5, "cabbage": 2.5, "courgette": 1.0,
    "zucchini": 1.0, "cucumber": 0.5, "celery": 1.6, "mushrooms": 1.0,
    "sweet potato": 3.0, "potato": 2.2, "potatoes": 2.2,
    "aubergine": 3.0, "eggplant": 3.0, "green beans": 2.7, "asparagus": 2.1,
    "corn": 2.7, "sweetcorn": 2.7, "beetroot": 2.8, "leek": 1.8,
    "pumpkin": 0.5, "butternut squash": 2.0, "sauerkraut": 2.9,
    "olives": 3.2, "sun-dried tomatoes": 5.8, "ginger": 2.0, "chilli": 1.5,
    "jalapeno": 2.6, "coleslaw": 2.5, "pickles": 1.2, "radish": 1.6,
    # Fruit
    "banana": 2.6, "apple": 2.4, "pear": 3.1, "orange": 2.4,
    "berries": 4.5, "mixed berries": 4.5, "blueberries": 2.4,
    "raspberries": 6.5, "strawberries": 2.0, "blackberries": 5.3,
    "mango": 1.6, "pineapple": 1.4, "grapes": 0.9, "kiwi": 3.0,
    "peach": 1.5, "melon": 0.9, "avocado": 6.7, "dates": 8.0,
    "raisins": 3.7, "dried apricots": 7.3, "prunes": 7.1,
    "lemon": 2.8, "lime": 2.8, "apple sauce": 1.2, "fig": 2.9,
    # Nuts and seeds
    "almonds": 12.5, "walnuts": 6.7, "cashews": 3.3, "peanuts": 8.5,
    "pecans": 9.6, "hazelnuts": 9.7, "pistachios": 10.3,
    "mixed nuts": 8.0, "nuts": 8.0, "pine nuts": 3.7,
    "peanut butter": 6.0, "almond butter": 10.3, "nut butter": 7.0,
    "tahini": 9.3, "chia seeds": 34.4, "flaxseed": 27.3,
    "linseed": 27.3, "pumpkin seeds": 6.0, "sunflower seeds": 8.6,
    "sesame seeds": 11.8, "seeds": 9.0, "coconut": 9.0,
    "desiccated coconut": 16.3, "cocoa powder": 33.2,
    "dark chocolate": 10.9, "protein bar": 5.0,
    # Known zeros -- facts, not gaps.
    "chicken": 0.0, "chicken breast": 0.0, "chicken thigh": 0.0,
    "chicken thighs": 0.0, "turkey": 0.0, "beef": 0.0, "mince": 0.0,
    "beef mince": 0.0, "steak": 0.0, "pork": 0.0, "bacon": 0.0,
    "lamb": 0.0, "ham": 0.0, "sausage": 0.0, "salmon": 0.0,
    "cod": 0.0, "haddock": 0.0, "tuna": 0.0, "prawns": 0.0,
    "shrimp": 0.0, "white fish": 0.0, "fish": 0.0, "trout": 0.0,
    "mackerel": 0.0, "herring": 0.0, "egg": 0.0, "eggs": 0.0,
    "egg white": 0.0, "egg whites": 0.0,
    "milk": 0.0, "oat milk": 0.8, "almond milk": 0.4, "soy milk": 0.5,
    "coconut milk": 0.0, "cream": 0.0, "creme fraiche": 0.0,
    "yoghurt": 0.0, "greek yoghurt": 0.0, "skyr": 0.0,
    "cottage cheese": 0.0, "cheese": 0.0, "cheddar": 0.0,
    "feta": 0.0, "mozzarella": 0.0, "parmesan": 0.0, "cream cheese": 0.0,
    "halloumi": 0.0, "butter": 0.0, "olive oil": 0.0, "oil": 0.0,
    "coconut oil": 0.0, "rapeseed oil": 0.0, "sesame oil": 0.0,
    "whey protein": 0.0, "protein powder": 0.0, "casein": 0.0,
    "honey": 0.0, "maple syrup": 0.0, "sugar": 0.0, "salt": 0.0,
    "pepper": 0.0, "black pepper": 0.0, "salt and pepper": 0.0,
    "vinegar": 0.0, "balsamic vinegar": 0.0, "soy sauce": 0.0,
    "fish sauce": 0.0, "mayonnaise": 0.0, "mustard": 0.0,
    "dijon mustard": 0.0, "ketchup": 0.0, "stock": 0.0,
    "water": 0.0, "ice": 0.0, "lemon juice": 0.0, "lime juice": 0.0,
    "vanilla": 0.0, "vanilla extract": 0.0, "cinnamon": 0.0,
    "paprika": 0.0, "smoked paprika": 0.0, "cumin": 0.0,
    "turmeric": 0.0, "oregano": 0.0, "basil": 0.0, "thyme": 0.0,
    "rosemary": 0.0, "dill": 0.0, "parsley": 0.0, "coriander": 0.0,
    "mint": 0.0, "chives": 0.0, "bay leaf": 0.0, "curry powder": 0.0,
    "curry paste": 0.0, "chilli flakes": 0.0, "chilli powder": 0.0,
    "stock cube": 0.0, "baking powder": 0.0, "nutritional yeast": 20.0,
    "pesto": 2.0, "harissa": 3.0, "sriracha": 0.0, "hot sauce": 0.0,
    "capers": 3.2, "horseradish": 3.3, "wasabi": 7.8, "nori": 0.3,
    "seasoning": 0.0, "spices": 0.0, "herbs": 0.0, "garnish": 0.0,
    # Spellings and items the first pass over the real data missed.
    "yogurt": 0.0, "greek yogurt": 0.0, "dijon": 0.0, "cocoa": 33.2,
    "croutons": 4.0, "wholewheat croutons": 6.5, "caesar dressing": 0.0,
    "dressing": 0.0, "vinaigrette": 0.0, "vegetables": 2.3,
    "mixed vegetables": 2.3, "crackers": 7.0, "seeded crackers": 10.0,
    "oat milk": 0.8, "soy yogurt": 0.5, "guacamole": 5.0, "salsa": 1.5, "tamari": 0.0, "oyster sauce": 0.0,
}

# ── Portion weights in grams ──────────────────────────────────────────────
PIECE_G = {
    "banana": 118, "apple": 180, "orange": 140, "pear": 175, "kiwi": 75,
    "avocado": 150, "onion": 110, "red onion": 110, "shallot": 40,
    "tomato": 123, "bell pepper": 120, "pepper": 120, "red pepper": 120,
    "carrot": 61, "cucumber": 300, "courgette": 200, "zucchini": 200,
    "sweet potato": 130, "potato": 170, "lemon": 60, "lime": 45,
    "egg": 50, "eggs": 50, "garlic": 3, "chilli": 15, "jalapeno": 14,
    "celery": 40, "leek": 90, "beetroot": 80, "mango": 200,
    "spring onion": 15, "bagel": 95, "wholemeal bagel": 95,
    "whole wheat bagel": 95, "tortilla": 45, "wholemeal tortilla": 45,
    "whole wheat tortilla": 45, "wrap": 60, "pita": 60, "fig": 50,
    "protein bar": 60, "stock cube": 10, "bay leaf": 0.2,
}
SLICE_G = {"rye bread": 32, "bread": 35, "wholemeal bread": 35,
           "whole wheat bread": 35, "sourdough bread": 40, "toast": 35,
           "cheese": 20, "ham": 15, "bacon": 15, "crispbread": 10,
           "tomato": 20, "cucumber": 10, "lemon": 8, "onion": 10}
TIN_G = {"chopped tomatoes": 400, "tomatoes": 400, "tuna": 145,
         "chickpeas": 240, "black beans": 240, "kidney beans": 240,
         "beans": 240, "coconut milk": 400, "lentils": 240,
         "baked beans": 400, "sweetcorn": 200, "corn": 200}
# A tablespoon is not 15 g of everything.
TBSP_G = {"olive oil": 13.5, "oil": 13.5, "coconut oil": 13.5,
          "sesame oil": 13.5, "rapeseed oil": 13.5, "butter": 14,
          "peanut butter": 16, "almond butter": 16, "nut butter": 16,
          "tahini": 15, "honey": 21, "maple syrup": 20, "sugar": 12.5,
          "chia seeds": 12, "flaxseed": 10, "linseed": 10,
          "pumpkin seeds": 9, "sunflower seeds": 9, "sesame seeds": 9,
          "seeds": 9, "almonds": 8, "walnuts": 8, "cashews": 9,
          "peanuts": 9, "nuts": 8, "mixed nuts": 8, "pecans": 8,
          "desiccated coconut": 5, "cocoa powder": 5, "flour": 8,
          "wholemeal flour": 8, "breadcrumbs": 7, "granola": 12,
          "oats": 6, "rolled oats": 6, "soy sauce": 16, "vinegar": 15,
          "balsamic vinegar": 16, "mayonnaise": 14, "mustard": 15,
          "dijon mustard": 15, "ketchup": 17, "pesto": 16,
          "yoghurt": 15, "greek yoghurt": 15, "cream": 15,
          "creme fraiche": 15, "cream cheese": 15, "curry paste": 16,
          "harissa": 15, "capers": 9, "parmesan": 5, "nutritional yeast": 5,
          "lemon juice": 15, "lime juice": 15, "stock": 15, "water": 15}

FRACTIONS = {"½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3,
             "⅛": 0.125, "1/2": 0.5, "1/4": 0.25, "3/4": 0.75,
             "1/3": 1 / 3, "2/3": 2 / 3}

NOISE = re.compile(
    r"\b(fresh|frozen|dried|chopped|sliced|diced|minced|grated|crushed|"
    r"cooked|raw|large|small|medium|ripe|lean|extra|plain|natural|"
    r"low[- ]fat|full[- ]fat|fat[- ]free|skimmed|semi[- ]skimmed|"
    r"wholegrain|organic|free[- ]range|smoked|tinned|canned|drained|"
    r"rinsed|optional|to taste|roughly|finely|thinly|halved|quartered|"
    r"cubed|shredded|torn|peeled|deseeded|cored|stemmed|trimmed|"
    r"boneless|skinless|skin[- ]on|bone[- ]in|hard[- ]boiled|soft[- ]boiled|"
    r"poached|scrambled|beaten|whisked|melted|softened|room temperature|"
    r"a few|handful|bunch|sprig|clove|cloves|tin of|can of|dash|pinch|"
    r"squeeze|drizzle|splash|about|approx|roughly|per person|each|"
    r"into|cut|for|the|and|with|of|in|on|or)\b", re.I)


def norm(food: str) -> str:
    f = food.lower()
    f = re.sub(r"\([^)]*\)", " ", f)
    f = f.replace("&", " ").replace(",", " ")
    f = NOISE.sub(" ", f)
    f = re.sub(r"[^a-zá-úäöåæø\s-]", " ", f)
    return re.sub(r"\s+", " ", f).strip()


def match(food: str):
    """Longest-name-first match, so 'peanut butter' never lands on 'butter'."""
    f = norm(food)
    if not f:
        return None
    if f in FIBRE_PER_100G:
        return f
    for key in sorted(FIBRE_PER_100G, key=len, reverse=True):
        if re.search(r"\b" + re.escape(key) + r"\b", f):
            return key
    # Singular/plural last resort.
    for key in sorted(FIBRE_PER_100G, key=len, reverse=True):
        if key.endswith("s") and re.search(r"\b" + re.escape(key[:-1]) + r"\b", f):
            return key
        if re.search(r"\b" + re.escape(key) + r"s\b", f):
            return key
    return None


def quantity(line: str):
    """(grams, had_explicit_quantity) for one ingredient line."""
    s = line.strip().lower()
    mult = 1.0
    for frac, val in FRACTIONS.items():
        if frac in s:
            mult = val
            s = s.replace(frac, " ")
            break
    num = re.search(r"(\d+[.,]?\d*)", s)
    if num:
        try:
            mult = mult * float(num.group(1).replace(",", ".")) if mult != 1.0 else float(num.group(1).replace(",", "."))
        except ValueError:
            pass
    key = match(line)

    if re.search(r"\b\d*\s*(g|gram|grams|gr)\b", s) and not re.search(r"\bkg\b", s):
        g = float(re.search(r"(\d+[.,]?\d*)\s*(?:g|gram|grams|gr)\b", s).group(1).replace(",", "."))
        return g, True
    if re.search(r"\bkg\b", s):
        return mult * 1000, True
    if re.search(r"\b(tbsp|tablespoon|tablespoons|msk)\b", s):
        return mult * TBSP_G.get(key or "", 15), True
    if re.search(r"\b(tsp|teaspoon|teaspoons|tsk)\b", s):
        return mult * 5, True
    if re.search(r"\b(dl|deciliter)\b", s):
        return mult * 100, True
    if re.search(r"\b(ml|cl)\b", s):
        ml = float(re.search(r"(\d+[.,]?\d*)\s*(?:ml|cl)\b", s).group(1).replace(",", "."))
        return (ml * 10 if "cl" in s else ml), True
    if re.search(r"\b(cup|cups)\b", s):
        return mult * 150, True
    if re.search(r"\b(slice|slices)\b", s):
        return mult * SLICE_G.get(key or "", 30), True
    if re.search(r"\b(tin|tins|can|cans)\b", s):
        return mult * TIN_G.get(key or "", 400), True
    if re.search(r"\b(scoop|scoops)\b", s):
        return mult * 30, True
    if re.search(r"\b(fillet|fillets|steak|steaks|breast|breasts|thigh|thighs)\b", s):
        return mult * 150, True
    if key in PIECE_G:
        return mult * PIECE_G[key], bool(num) or mult != 1.0
    # No quantity at all: a seasoning line ("salt", "dill", "olive oil").
    return 5.0, False


def fibre_for(ingredients, servings=1):
    """Fibre per serving.

    The ingredient lists are written for the whole recipe while protein,
    carbs, fat and calories on the same row are per serving — "4 sweet
    potatoes, 2 tins black beans" sits beside 22 g protein and 580 kcal.
    Dividing by `servings` is what makes this column mean the same thing as
    the ones beside it; without it a two-portion bean dish reported double
    everybody else's fibre.
    """
    total = 0.0
    known_g = 0.0
    all_g = 0.0
    unknown = []
    for line in ingredients or []:
        grams, explicit = quantity(line)
        key = match(line)
        all_g += grams
        if key is None:
            # Unquantified unknowns are seasonings; they carry no weight in
            # the coverage figure because they carry no weight on the plate.
            if explicit:
                unknown.append(line)
            else:
                known_g += grams
            continue
        known_g += grams
        total += grams * FIBRE_PER_100G[key] / 100.0
    cov = (known_g / all_g) if all_g > 0 else 0.0
    n = max(1, int(servings or 1))
    return round(total / n, 1), round(cov, 3), unknown


def main():
    write = "--write" in sys.argv
    token = open(os.path.expanduser("~/.supabase/access-token")).read().strip()
    proj = "cfnibfxzltxiriqxvvru"

    def sql(q):
        req = urllib.request.Request(
            f"https://api.supabase.com/v1/projects/{proj}/database/query",
            data=json.dumps({"query": q}).encode(),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            method="POST")
        return json.loads(urllib.request.urlopen(req, timeout=120).read())

    rows = sql("select id, name, ingredients, servings, protein, calories from meals order by name;")
    out, low, misses = [], [], {}
    for r in rows:
        ings = r["ingredients"]
        # "Apple + 6 almonds", "Carrots + hummus, 2 tbsp" — no ingredient
        # array at all, because the name is the recipe. Splitting the name
        # on + and , recovers exactly the foods it names, and these are
        # always one portion.
        if not ings:
            # On "+" only. Splitting on commas too turned "Cold chicken
            # breast, 100g" into a foodless "100g" fragment and lost the
            # row; the comma in these names introduces the quantity, not
            # another food.
            ings = [x for x in r["name"].split("+") if x.strip()]
        g, cov, unknown = fibre_for(ings, r["servings"])
        for u in unknown:
            misses[u] = misses.get(u, 0) + 1
        if cov >= MIN_COVERAGE:
            out.append((r["id"], g, cov, r["name"]))
        else:
            low.append((r["name"], cov, unknown))

    print(f"meals: {len(rows)}   computed: {len(out)}   below {MIN_COVERAGE:.0%} coverage: {len(low)}")
    if out:
        vals = sorted(x[1] for x in out)
        print(f"fibre g/serving — min {vals[0]}  median {vals[len(vals)//2]}  max {vals[-1]}")
        print("\nhighest:")
        for i, g, c, n in sorted(out, key=lambda x: -x[1])[:6]:
            print(f"  {g:>5} g  (cov {c:.0%})  {n[:52]}")
        print("lowest:")
        for i, g, c, n in sorted(out, key=lambda x: x[1])[:6]:
            print(f"  {g:>5} g  (cov {c:.0%})  {n[:52]}")
    if low:
        print(f"\nleft NULL ({len(low)}):")
        for n, c, u in low[:8]:
            print(f"  cov {c:.0%}  {n[:40]}  missing: {', '.join(u[:3])[:60]}")
    if misses:
        print("\nunmatched ingredient lines, by frequency:")
        for k, v in sorted(misses.items(), key=lambda x: -x[1])[:12]:
            print(f"  {v:>3}x  {k[:62]}")

    if not write:
        print("\n(report only — pass --write to update the table)")
        return

    for i in range(0, len(out), 40):
        chunk = out[i:i + 40]
        cases = " ".join(f"when '{mid}'::uuid then {g}" for mid, g, _, _ in chunk)
        covs = " ".join(f"when '{mid}'::uuid then {c}" for mid, _, c, _ in chunk)
        ids = ",".join(f"'{mid}'::uuid" for mid, _, _, _ in chunk)
        sql(f"update meals set fibre_g = case id {cases} end, "
            f"fibre_coverage = case id {covs} end where id in ({ids});")
    print(f"\nwrote fibre_g for {len(out)} meals")


if __name__ == "__main__":
    main()
