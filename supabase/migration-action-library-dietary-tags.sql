-- =============================================================
-- action_library: dietary + allergen contraindication backfill
--
-- Populates action_library.contraindications (text[]) with the
-- contains_<food> tags that getUserContraindications() in
-- src/services/api.ts adds when a user has the matching dietary
-- preference or allergy:
--
--   Vegan          → contains_meat, contains_fish, contains_dairy, contains_eggs
--   Vegetarian     → contains_meat, contains_fish
--   Pescatarian    → contains_meat
--   Halal / Kosher → contains_pork
--   Allergies      → contains_<allergen>
--
-- Heuristics scan label + details for keyword matches. Conservative
-- by design: under-tagging means a vegan sees a stray chicken recipe
-- (annoying but recoverable via "Not for me"); over-tagging hides
-- content the user wanted. We only tag on unambiguous keywords.
--
-- Idempotent: only ADDS the tag if not already present. Re-runnable
-- safely after the action library grows. Scoped to nutrition pillar
-- so we don't accidentally tag an exercise like "Egg-and-spoon race
-- mobility drill" as contains_eggs.
-- =============================================================

DO $$
DECLARE
  -- Each tuple: tag, regex (case-insensitive, applied to label+details)
  tag_rules text[][] := ARRAY[
    -- Animal proteins → meat family
    ARRAY['contains_meat',      '\m(beef|pork|chicken|turkey|lamb|veal|bison|meatball|burger|steak|sausage|bacon|ham|prosciutto|salami|chorizo|brisket|ribs?|jerky|carnitas|gyros?|kebab|kofta|meatloaf)\M'],
    ARRAY['contains_meat',      '\m(ground beef|pulled pork|short rib|chicken thigh|chicken breast|turkey breast|lamb shank|pork chop|pork loin)\M'],
    -- Fish (any sea creature with fins) — separate so pescatarians keep it
    ARRAY['contains_fish',      '\m(salmon|tuna|cod|halibut|mackerel|sardine|sardines|anchovy|anchovies|trout|herring|haddock|tilapia|sea bass|pollock|swordfish|catfish|whitefish)\M'],
    ARRAY['contains_fish',      '\m(smoked salmon|canned tuna|fish (cake|stew|soup|taco))\M'],
    -- Shellfish (allergy-tracked separately from fish)
    ARRAY['contains_shellfish', '\m(shellfish|shrimp|prawn|prawns|crab|lobster|mussel|mussels|oyster|oysters|clam|clams|scallop|scallops|crayfish|crawfish|langoustine|crab cake)\M'],
    -- Pork-specific (halal/kosher)
    ARRAY['contains_pork',      '\m(pork|bacon|ham|sausage|prosciutto|salami|chorizo|pepperoni|pancetta|carnitas|lard|guanciale)\M'],
    -- Dairy
    ARRAY['contains_dairy',     '\m(milk|yogurt|yoghurt|cheese|cheddar|mozzarella|parmesan|feta|ricotta|cottage cheese|cream cheese|butter|cream|sour cream|whey|whey protein|casein|ghee|kefir|skyr|labneh)\M'],
    -- Eggs
    ARRAY['contains_eggs',      '\m(eggs?|omelette|omelet|frittata|quiche|scrambled|poached egg|hard-boiled|hard boiled|deviled|mayonnaise)\M'],
    -- Tree nuts
    ARRAY['contains_tree_nuts', '\m(almond|almonds|walnut|walnuts|cashew|cashews|pecan|pecans|hazelnut|hazelnuts|pistachio|pistachios|brazil nut|macadamia|nut butter|almond butter|cashew butter|nut milk|almond milk|pesto)\M'],
    -- Peanuts (technically legumes, but allergen-distinct)
    ARRAY['contains_peanuts',   '\m(peanut|peanuts|peanut butter|satay)\M'],
    -- Soy
    ARRAY['contains_soy',       '\m(soy|soya|soybean|tofu|tempeh|edamame|miso|tamari|soy sauce)\M'],
    -- Gluten / wheat
    ARRAY['contains_gluten',    '\m(wheat|bread|toast|pasta|noodle|noodles|bagel|crackers?|couscous|barley|rye|spelt|farro|bulgur|seitan|udon|ramen|orzo|gnocchi|tortilla|pita|naan|pretzel)\M'],
    -- Sesame
    ARRAY['contains_sesame',    '\m(sesame|tahini|halva|hummus)\M']
  ];
  r            text[];
  tag          text;
  pattern      text;
  scope_text   text;
  affected_id  uuid;
  affected     integer;
  total        integer := 0;
BEGIN
  FOR i IN 1..array_length(tag_rules, 1) LOOP
    tag     := tag_rules[i][1];
    pattern := tag_rules[i][2];

    UPDATE public.action_library a
    SET    contraindications =
             (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(a.contraindications, ARRAY[]::text[]) || ARRAY[tag])))
    WHERE  a.primary_pillar = 'nutrition'
      AND  NOT (COALESCE(a.contraindications, ARRAY[]::text[]) @> ARRAY[tag])
      AND  (
        a.label ~* pattern
        OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(a.details, ARRAY[]::text[])) AS d
          WHERE d ~* pattern
        )
      );

    GET DIAGNOSTICS affected = ROW_COUNT;
    total := total + affected;
    RAISE NOTICE 'tagged % rows with %', affected, tag;
  END LOOP;

  RAISE NOTICE 'Done. % total tag-applications.', total;
END $$;

-- =============================================================
-- Sanity check view (read-only). Run as staff:
--   SELECT * FROM public.action_library_dietary_audit;
-- to inspect what each rule tagged.
-- =============================================================

DROP VIEW IF EXISTS public.action_library_dietary_audit;
CREATE VIEW public.action_library_dietary_audit AS
SELECT
  lib_key,
  label,
  primary_pillar,
  contraindications,
  -- Quick boolean breakdown so staff can scan for surprising tag sets
  ARRAY['contains_meat','contains_fish','contains_shellfish','contains_pork',
        'contains_dairy','contains_eggs','contains_tree_nuts','contains_peanuts',
        'contains_soy','contains_gluten','contains_sesame']
    && COALESCE(contraindications, ARRAY[]::text[]) AS has_any_dietary_tag
FROM public.action_library
WHERE primary_pillar = 'nutrition'
ORDER BY label;
