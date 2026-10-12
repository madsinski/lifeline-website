# -*- coding: utf-8 -*-
"""Replace the meal library with a curated Lifeline list.

Usage: python3 -I scripts/import-lifeline-meals.py <file.json> [--apply]

Without --apply it prints what it would do and writes nothing.

── What "replace" means here ───────────────────────────────────────────────

The old meals are RETIRED, not deleted, and this is not timidity:

  * action_meals has 2268 rows pointing at 23 of them, and that table feeds
    the iOS app's nutrition action groups. The app joins meals without
    filtering `retired`, so retiring keeps every one of those links working
    while removing the meal from the website's library, which does filter.
  * meal_log stores a description and macros rather than a meal_id, so
    diary history is untouched either way.

Deleting would have taken the app's programme meals with it.

── Categories ──────────────────────────────────────────────────────────────

The file uses eight: breakfast, lunch, dinner, snack, coffee, box, sauce,
wrap. The app serves four, and filters a slot picker on category equality.

  box, wrap   → lunch. They are lunch-shaped main meals (512-744 kcal,
                39-50 g protein for the boxes), so hiding them would waste
                fourteen of the best entries on the list.
  coffee      → kept as "coffee". An espresso is 1 kcal; offering it as a
                meal would be wrong, and the snack scorer already penalises
                anything under 120 kcal.
  sauce       → kept as "sauce". A condiment is not a meal.

Nothing is dropped: the eighteen drinks and sauces are imported with their
own category, invisible to the meal pickers until something is built that
wants them. The original category is kept in curated.source_category, so
this is reversible without re-reading the file.
"""
import json
import sys

SLOT_CATEGORIES = {"breakfast", "lunch", "dinner", "snack"}
# Re-homed into a slot the app serves.
REMAP = {"box": "lunch", "wrap": "lunch"}
# Imported, but deliberately not offered as a meal.
NOT_A_MEAL = {"coffee", "sauce"}


def lit(v):
    """A Postgres literal. None → NULL; everything else quoted and escaped."""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def arr(items):
    """A text[] literal."""
    if not items:
        return "NULL"
    return "array[" + ", ".join(lit(x) for x in items) + "]::text[]"


def build(path):
    doc = json.load(open(path, encoding="utf-8"))
    meals = doc["meals"]
    rows, notes = [], []

    for m in meals:
        src_cat = m["category"]
        cat = REMAP.get(src_cat, src_cat)
        mac = m.get("macros_per_serving") or {}

        # dietary_tags: only values the scorer already understands, plus the
        # provenance of a re-homed category. meal-prep is a real tag — the
        # cooking-preference filter in meals.ts matches on it — so taking it
        # from the file's own flag makes those meals findable by somebody who
        # said they batch-cook.
        tags = []
        if m.get("meal_prep"):
            tags.append("meal-prep")
        if m.get("freezer"):
            tags.append("freezer")
        if src_cat != cat:
            tags.append(src_cat)

        curated = {
            "why": m.get("why"),
            "highlights": m.get("highlights") or [],
            "tip": m.get("tip"),
            "fodmap_note": m.get("fodmap_note"),
            "serving_note": m.get("serving_note"),
            "keeps_days": m.get("keeps_days"),
            "meal_prep": bool(m.get("meal_prep")),
            "freezer": bool(m.get("freezer")),
            "uses_prep": m.get("uses_prep") or [],
            "makes": m.get("makes") or [],
            "illustration": m.get("illustration"),
            "source_id": m.get("id"),
            "source_category": src_cat,
        }

        rows.append({
            "name": m["name"],
            "name_is": m.get("name_is"),
            # `why` is the curated explanation and the closest thing to a
            # description the file has. English, like the rest of the prose.
            "description": m.get("why"),
            "category": cat,
            "ingredients": [i["text"] for i in (m.get("ingredients") or []) if i.get("text")],
            "instructions": m.get("steps") or [],
            "prep_time_min": m.get("time_min"),
            "servings": m.get("servings") or 1,
            "calories": mac.get("kcal"),
            "protein": mac.get("protein"),
            "carbs": mac.get("carbs"),
            "fat": mac.get("fat"),
            "dietary_tags": tags,
            "curated": curated,
        })

        if cat not in SLOT_CATEGORIES and cat not in NOT_A_MEAL:
            notes.append(f"unexpected category {cat!r} on {m['name_is']!r}")

    return doc, rows, notes


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(2)
    path = sys.argv[1]
    apply = "--apply" in sys.argv
    doc, rows, notes = build(path)

    by_cat = {}
    for r in rows:
        by_cat[r["category"]] = by_cat.get(r["category"], 0) + 1
    print(f"file version {doc.get('version')}: {len(rows)} meals")
    for c, n in sorted(by_cat.items(), key=lambda x: -x[1]):
        offered = "offered" if c in SLOT_CATEGORIES else "held, not offered as a meal"
        print(f"   {c:<11} {n:>3}   {offered}")
    missing_is = sum(1 for r in rows if not r["name_is"])
    print(f"\n   without an Icelandic name: {missing_is}")
    print("   ingredients and steps are English for every row: ingredients_is "
          "and instructions_is are left NULL, so the app falls back to English")
    for n in notes:
        print("   NOTE:", n)

    stmts = []
    for r in rows:
        stmts.append(
            "insert into meals (name, name_is, description, category, ingredients, "
            "instructions, prep_time_min, servings, calories, protein, carbs, fat, "
            "dietary_tags, curated, retired, is_filler) values ("
            f"{lit(r['name'])}, {lit(r['name_is'])}, {lit(r['description'])}, {lit(r['category'])}, "
            f"{arr(r['ingredients'])}, {arr(r['instructions'])}, {lit(r['prep_time_min'])}, "
            f"{lit(r['servings'])}, {lit(r['calories'])}, {lit(r['protein'])}, {lit(r['carbs'])}, "
            f"{lit(r['fat'])}, {arr(r['dietary_tags'])}, "
            f"{lit(json.dumps(r['curated'], ensure_ascii=False))}::jsonb, false, false);"
        )
    out = "sql-insert-meals.sql"
    with open(out, "w", encoding="utf-8") as fh:
        # Retire first, in the same transaction, so there is never a moment
        # with both libraries live.
        fh.write("begin;\n\nupdate meals set retired = true where retired = false;\n\n")
        fh.write("\n".join(stmts))
        fh.write("\n\ncommit;\n")
    print(f"\nwrote {out} ({len(stmts)} inserts, preceded by one retire-all, in one transaction)")
    if not apply:
        print("dry run — nothing written to the database. Pass --apply to run it.")


if __name__ == "__main__":
    main()
