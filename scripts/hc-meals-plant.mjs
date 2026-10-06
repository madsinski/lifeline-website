// Filling the holes a restriction leaves.
//
// Measured against the live library: a vegan had ZERO breakfasts and one
// dinner; a vegan who also avoids gluten had no breakfast, no dinner and one
// lunch; a vegetarian avoiding gluten had no dinner at all. A plan that
// cannot feed someone is not a plan, and the setup screen warning them about
// it is not a fix.
//
// Almost everything here is vegan AND gluten-free on purpose, because one
// such meal counts for the vegan, the vegetarian, the dairy-free, the
// milk-allergic and the coeliac at once. Protein is aimed near the slot's
// share of a day's target rather than as high as legumes can be pushed.
//
// Run: node scripts/hc-meals-plant.mjs [--apply]

export const BREAKFAST = [
  {
    name: "Overnight oats with oat milk and berries", name_is: "Næturhafrar með haframjólk og berjum",
    description: "Stirred the night before. Use oats marked gluten-free and it suits everyone.",
    description_is: "Hrært kvöldinu áður. Notaðu hafra sem eru merktir glútenlausir og þá hentar þetta öllum.",
    ingredients: ["60 g gluten-free oats", "2 dl oat milk", "1 tbsp chia seeds", "100 g berries", "1 tbsp pumpkin seeds"],
    ingredients_is: ["60 g glútenlaust haframjöl", "2 dl haframjólk", "1 msk chiafræ", "100 g ber", "1 msk graskersfræ"],
    instructions: ["Stir the oats, chia and oat milk together in a jar.", "Leave it in the fridge overnight.", "Berries and seeds on top in the morning."],
    instructions_is: ["Hrærðu höfrunum, chiafræjunum og haframjólkinni saman í krukku.", "Láttu standa í kæli yfir nótt.", "Ber og fræ ofan á að morgni."],
    prep_time_min: 5, cook_time_min: 0, calories: 390, protein: 14, carbs: 56, fat: 12,
    dietary_tags: ["vegetarian", "vegan", "dairy-free", "gluten-free", "no-cook", "meal-prep"],
  },
  {
    name: "Tofu scramble with spinach and tomato", name_is: "Tófúhræra með spínati og tómötum",
    description: "What scrambled eggs are to everyone else. Turmeric does the colour.",
    description_is: "Það sem eggjahræra er fyrir aðra. Túrmerik sér um litinn.",
    ingredients: ["200 g firm tofu", "1 handful spinach", "1 tomato", "½ tsp turmeric", "1 tbsp oil", "Salt and pepper"],
    ingredients_is: ["200 g þétt tófú", "1 lúka spínat", "1 tómatur", "½ tsk túrmerik", "1 msk olía", "Salt og pipar"],
    instructions: ["Crumble the tofu into a hot oiled pan and fry for four minutes.", "Add the turmeric, salt and pepper, then the chopped tomato.", "Stir the spinach through at the end until it wilts."],
    instructions_is: ["Myldu tófúið á heita pönnu með olíu og steiktu í fjórar mínútur.", "Settu túrmerik, salt og pipar út í og svo saxaða tómatinn.", "Hrærðu spínatinu saman við í lokin þar til það fellur saman."],
    prep_time_min: 4, cook_time_min: 7, calories: 320, protein: 22, carbs: 10, fat: 22,
    dietary_tags: ["high-protein", "vegetarian", "vegan", "dairy-free", "gluten-free", "low-carb"],
  },
  {
    name: "Chia pudding with oat milk and peanut butter", name_is: "Chiabúðingur með haframjólk og hnetusmjöri",
    description: "The overnight pudding without a drop of dairy.",
    description_is: "Búðingurinn yfir nótt, án nokkurra mjólkurvara.",
    ingredients: ["3 tbsp chia seeds", "2 dl oat milk", "1 tbsp peanut butter", "1 banana", "1 tsp cocoa"],
    ingredients_is: ["3 msk chiafræ", "2 dl haframjólk", "1 msk hnetusmjör", "1 banani", "1 tsk kakó"],
    instructions: ["Stir the chia, cocoa and oat milk together.", "Leave it in the fridge overnight.", "Swirl the peanut butter through and slice the banana over."],
    instructions_is: ["Hrærðu chiafræjunum, kakóinu og haframjólkinni saman.", "Láttu standa í kæli yfir nótt.", "Hrærðu hnetusmjörinu í gegn og skerðu bananann yfir."],
    prep_time_min: 5, cook_time_min: 0, calories: 400, protein: 15, carbs: 42, fat: 20,
    dietary_tags: ["vegetarian", "vegan", "dairy-free", "gluten-free", "no-cook", "meal-prep"],
  },
  {
    name: "Baked beans on gluten-free toast", name_is: "Baunir á glútenlausu ristuðu brauði",
    description: "A tin and a toaster. Five minutes, and it carries you to lunch.",
    description_is: "Ein dós og brauðrist. Fimm mínútur og þú kemst til hádegis.",
    ingredients: ["1 tin baked beans", "2 slices gluten-free bread", "1 tsp olive oil", "Pepper"],
    ingredients_is: ["1 dós baunir í tómatsósu", "2 sneiðar glútenlaust brauð", "1 tsk ólífuolía", "Pipar"],
    instructions: ["Warm the beans in a small pot.", "Toast the bread and trickle the oil over it.", "Beans on top, pepper over."],
    instructions_is: ["Hitaðu baunirnar í litlum potti.", "Ristaðu brauðið og dreyptu olíunni yfir.", "Baunir ofan á og pipar yfir."],
    prep_time_min: 2, cook_time_min: 5, calories: 380, protein: 18, carbs: 58, fat: 8,
    dietary_tags: ["vegetarian", "vegan", "dairy-free", "gluten-free"],
  },
  {
    name: "Berry and plant-protein smoothie bowl", name_is: "Berjaskál með jurtapróteini",
    description: "Blended thick enough to eat with a spoon, with seeds for crunch.",
    description_is: "Blandað nógu þykkt til að borða með skeið, með fræjum fyrir stökkleikann.",
    ingredients: ["150 g frozen berries", "1 banana", "25 g plant protein powder", "1,5 dl oat milk", "1 tbsp sunflower seeds"],
    ingredients_is: ["150 g frosin ber", "1 banani", "25 g jurtaprótein", "1,5 dl haframjólk", "1 msk sólblómafræ"],
    instructions: ["Blend the berries, banana, protein and oat milk until thick.", "Pour it into a bowl.", "Seeds over the top."],
    instructions_is: ["Blandaðu berjunum, bananum, próteininu og haframjólkinni þar til það er þykkt.", "Helltu í skál.", "Fræ yfir."],
    prep_time_min: 5, cook_time_min: 0, calories: 370, protein: 26, carbs: 48, fat: 9,
    dietary_tags: ["high-protein", "vegetarian", "vegan", "dairy-free", "gluten-free", "no-cook"],
  },
  {
    name: "Avocado and bean toast", name_is: "Avókadó og baunir á glútenlausu brauði",
    description: "Mashed avocado, white beans on top, lemon over. No cooking at all.",
    description_is: "Stappað avókadó, hvítar baunir ofan á og sítróna yfir. Engin eldamennska.",
    ingredients: ["2 slices gluten-free bread", "1 avocado", "150 g white beans", "½ lemon", "Salt and pepper"],
    ingredients_is: ["2 sneiðar glútenlaust brauð", "1 avókadó", "150 g hvítar baunir", "½ sítróna", "Salt og pipar"],
    instructions: ["Toast the bread and mash the avocado onto it.", "Rinse the beans and pile them on.", "Lemon, salt and pepper."],
    instructions_is: ["Ristaðu brauðið og stappaðu avókadóinu á það.", "Skolaðu baunirnar og settu þær ofan á.", "Sítróna, salt og pipar."],
    prep_time_min: 6, cook_time_min: 0, calories: 420, protein: 16, carbs: 44, fat: 20,
    dietary_tags: ["vegetarian", "vegan", "dairy-free", "gluten-free", "no-cook"],
  },
];

export const LUNCH = [
  {
    name: "Bean and vegetable salad bowl", name_is: "Baunasalat með grænmeti",
    description: "A tin of beans, whatever is in the drawer, oil and lemon. Keeps two days.",
    description_is: "Ein dós af baunum, það sem er í skúffunni, olía og sítróna. Geymist í tvo daga.",
    ingredients: ["1 tin chickpeas or mixed beans", "½ cucumber", "1 tomato", "¼ red onion", "1 tbsp olive oil", "½ lemon", "Salt and pepper"],
    ingredients_is: ["1 dós kjúklingabaunir eða blandaðar baunir", "½ gúrka", "1 tómatur", "¼ rauðlaukur", "1 msk ólífuolía", "½ sítróna", "Salt og pipar"],
    instructions: ["Rinse and drain the beans into a box.", "Chop the vegetables in.", "Oil, lemon, salt and pepper, and shake the lid on."],
    instructions_is: ["Skolaðu baunirnar og helltu þeim í box.", "Saxaðu grænmetið saman við.", "Olía, sítróna, salt og pipar og hristu með lokinu á."],
    prep_time_min: 8, cook_time_min: 0, calories: 420, protein: 20, carbs: 48, fat: 16,
    dietary_tags: ["vegetarian", "vegan", "dairy-free", "gluten-free", "no-cook", "meal-prep"],
  },
  {
    name: "Rice bowl with tofu and vegetables", name_is: "Hrísgrjónaskál með tófú og grænmeti",
    description: "Cold rice from yesterday, fried tofu, raw vegetables. Nothing fancy.",
    description_is: "Köld hrísgrjón frá í gær, steikt tófú og hrátt grænmeti. Ekkert flókið.",
    ingredients: ["200 g cooked rice", "150 g firm tofu", "1 carrot", "½ cucumber", "1 tbsp oil", "1 tbsp tamari (gluten-free soy sauce)"],
    ingredients_is: ["200 g soðin hrísgrjón", "150 g þétt tófú", "1 gulrót", "½ gúrka", "1 msk olía", "1 msk tamari (glútenlaus sojasósa)"],
    instructions: ["Cut the tofu into cubes and fry until golden on two sides.", "Grate the carrot and chop the cucumber into the rice.", "Tofu on top, tamari over."],
    instructions_is: ["Skerðu tófúið í teninga og steiktu þar til það er gyllt á tveimur hliðum.", "Rífðu gulrótina og saxaðu gúrkuna saman við hrísgrjónin.", "Tófú ofan á og tamari yfir."],
    prep_time_min: 7, cook_time_min: 8, calories: 460, protein: 24, carbs: 54, fat: 16,
    dietary_tags: ["high-protein", "vegetarian", "vegan", "dairy-free", "gluten-free", "meal-prep"],
  },
  {
    name: "Lentil and vegetable soup from the freezer", name_is: "Linsubaunasúpa úr frystinum",
    description: "Make a big pot on Sunday, freeze it in portions, eat it all week.",
    description_is: "Eldaðu stóran pott á sunnudegi, frystu í skömmtum og borðaðu alla vikuna.",
    ingredients: ["1 frozen portion of lentil soup", "1 slice gluten-free bread", "1 tsp olive oil"],
    ingredients_is: ["1 frosinn skammtur af linsubaunasúpu", "1 sneið glútenlaust brauð", "1 tsk ólífuolía"],
    instructions: ["Take a portion out the night before.", "Reheat it until it steams through.", "Bread and oil on the side."],
    instructions_is: ["Taktu skammt úr frystinum kvöldinu áður.", "Hitaðu þar til rýkur úr henni.", "Brauð og olía með."],
    prep_time_min: 3, cook_time_min: 7, calories: 420, protein: 22, carbs: 56, fat: 10,
    dietary_tags: ["vegetarian", "vegan", "dairy-free", "gluten-free", "meal-prep"],
  },
  {
    name: "Potato salad with chickpeas", name_is: "Kartöflusalat með kjúklingabaunum",
    description: "Cold potatoes, a tin of chickpeas, mustard and oil instead of mayonnaise.",
    description_is: "Kaldar kartöflur, dós af kjúklingabaunum, sinnep og olía í stað majóness.",
    ingredients: ["300 g cooked potatoes", "1 tin chickpeas", "1 tsp mustard", "1 tbsp olive oil", "Chives", "Salt and pepper"],
    ingredients_is: ["300 g soðnar kartöflur", "1 dós kjúklingabaunir", "1 tsk sinnep", "1 msk ólífuolía", "Graslaukur", "Salt og pipar"],
    instructions: ["Chop the cold potatoes into a box with the rinsed chickpeas.", "Whisk the mustard and oil and stir it through.", "Chives, salt and pepper."],
    instructions_is: ["Saxaðu köldu kartöflurnar í box með skoluðum kjúklingabaunum.", "Hrærðu sinnepinu og olíunni saman og blandaðu við.", "Graslaukur, salt og pipar."],
    prep_time_min: 8, cook_time_min: 0, calories: 440, protein: 18, carbs: 58, fat: 14,
    dietary_tags: ["vegetarian", "vegan", "dairy-free", "gluten-free", "no-cook", "meal-prep"],
  },
];

export const DINNER = [
  {
    name: "Red lentil dal with rice", name_is: "Rauðar linsubaunir í dal með hrísgrjónum",
    description: "One pot, twenty-five minutes, and cheaper than almost anything else.",
    description_is: "Einn pottur, tuttugu og fimm mínútur og ódýrara en nánast allt annað.",
    ingredients: ["300 g red lentils", "1 tin coconut milk", "1 onion", "2 cloves garlic", "2 tsp curry powder", "300 g rice", "Salt"],
    ingredients_is: ["300 g rauðar linsubaunir", "1 dós kókosmjólk", "1 laukur", "2 hvítlauksgeirar", "2 tsk karrí", "300 g hrísgrjón", "Salt"],
    instructions: ["Fry the chopped onion and garlic with the curry powder for two minutes.", "Add the lentils, the coconut milk and 4 dl water, and simmer 20 minutes.", "Boil the rice while it cooks and salt the dal at the end."],
    instructions_is: ["Steiktu saxaðan lauk og hvítlauk með karríinu í tvær mínútur.", "Settu linsubaunirnar, kókosmjólkina og 4 dl vatn út í og láttu malla í 20 mínútur.", "Sjóddu hrísgrjónin á meðan og saltaðu dalið í lokin."],
    prep_time_min: 8, cook_time_min: 25, calories: 620, protein: 28, carbs: 86, fat: 18,
    dietary_tags: ["vegetarian", "vegan", "dairy-free", "gluten-free", "meal-prep"],
  },
  {
    name: "Chickpea curry with rice", name_is: "Kjúklingabaunakarrí með hrísgrjónum",
    description: "Two tins and an onion. The cheapest good dinner in the book.",
    description_is: "Tvær dósir og laukur. Ódýrasti góði kvöldmaturinn í bókinni.",
    ingredients: ["2 tins chickpeas", "1 tin chopped tomatoes", "1 onion", "2 tbsp curry paste", "200 g spinach", "300 g rice"],
    ingredients_is: ["2 dósir kjúklingabaunir", "1 dós niðursaxaðir tómatar", "1 laukur", "2 msk karrímauk", "200 g spínat", "300 g hrísgrjón"],
    instructions: ["Fry the chopped onion with the curry paste for two minutes.", "Add the tomatoes and the rinsed chickpeas and simmer 15 minutes.", "Stir the spinach through at the end; serve with the rice."],
    instructions_is: ["Steiktu saxaðan lauk með karrímaukinu í tvær mínútur.", "Settu tómatana og skoluðu kjúklingabaunirnar út í og láttu malla í 15 mínútur.", "Hrærðu spínatinu saman við í lokin og berðu fram með hrísgrjónunum."],
    prep_time_min: 8, cook_time_min: 22, calories: 600, protein: 26, carbs: 88, fat: 14,
    dietary_tags: ["vegetarian", "vegan", "dairy-free", "gluten-free", "meal-prep"],
  },
  {
    name: "Bean chili with rice", name_is: "Baunachili með hrísgrjónum",
    description: "What a mince chili is, without the mince. Better on the second day.",
    description_is: "Það sem hakkchili er, bara án hakksins. Betra á öðrum degi.",
    ingredients: ["2 tins mixed beans", "1 tin chopped tomatoes", "1 onion", "1 pepper", "2 tsp paprika", "1 tsp cumin", "300 g rice"],
    ingredients_is: ["2 dósir blandaðar baunir", "1 dós niðursaxaðir tómatar", "1 laukur", "1 paprika", "2 tsk paprikuduft", "1 tsk kúmen", "300 g hrísgrjón"],
    instructions: ["Fry the chopped onion and pepper for five minutes with the spices.", "Add the tomatoes and the rinsed beans and simmer 20 minutes.", "Serve with the rice."],
    instructions_is: ["Steiktu saxaðan lauk og papriku í fimm mínútur með kryddinu.", "Settu tómatana og skoluðu baunirnar út í og láttu malla í 20 mínútur.", "Berðu fram með hrísgrjónunum."],
    prep_time_min: 8, cook_time_min: 25, calories: 580, protein: 26, carbs: 92, fat: 8,
    dietary_tags: ["vegetarian", "vegan", "dairy-free", "gluten-free", "meal-prep"],
  },
  {
    name: "Tofu and vegetable stir-fry with rice", name_is: "Tófú og grænmeti á wok með hrísgrjónum",
    description: "Hot pan, hard vegetables first, tamari at the end. Fifteen minutes.",
    description_is: "Heit panna, harðasta grænmetið fyrst og tamari í lokin. Fimmtán mínútur.",
    ingredients: ["400 g firm tofu", "1 broccoli", "2 carrots", "1 pepper", "2 tbsp tamari", "1 tbsp oil", "300 g rice"],
    ingredients_is: ["400 g þétt tófú", "1 brokkolí", "2 gulrætur", "1 paprika", "2 msk tamari", "1 msk olía", "300 g hrísgrjón"],
    instructions: ["Press the tofu dry, cube it and fry until golden; set it aside.", "Stir-fry the carrots first, then the broccoli and pepper, for six minutes.", "Tofu back in, tamari over, and serve with the rice."],
    instructions_is: ["Þerraðu tófúið, skerðu í teninga og steiktu þar til gyllt; taktu til hliðar.", "Steiktu gulræturnar fyrst, svo brokkolíið og paprikuna, í sex mínútur.", "Settu tófúið aftur út í, tamari yfir og berðu fram með hrísgrjónunum."],
    prep_time_min: 10, cook_time_min: 18, calories: 560, protein: 32, carbs: 66, fat: 18,
    dietary_tags: ["high-protein", "vegetarian", "vegan", "dairy-free", "gluten-free"],
  },
  {
    name: "Baked sweet potato with black beans", name_is: "Ofnbökuð sæt kartafla með svörtum baunum",
    description: "The oven does the work. Open it up, fill it, eat it.",
    description_is: "Ofninn vinnur verkið. Opnaðu hana, fylltu hana og borðaðu.",
    ingredients: ["4 sweet potatoes", "2 tins black beans", "1 tsp paprika", "1 avocado", "½ lime", "Salt and pepper"],
    ingredients_is: ["4 sætar kartöflur", "2 dósir svartar baunir", "1 tsk paprikuduft", "1 avókadó", "½ lime", "Salt og pipar"],
    instructions: ["Bake the sweet potatoes whole at 200°C for 45 minutes.", "Warm the rinsed beans with the paprika, salt and pepper.", "Split the potatoes, fill with beans and top with avocado and lime."],
    instructions_is: ["Bakaðu sætu kartöflurnar heilar við 200°C í 45 mínútur.", "Hitaðu skoluðu baunirnar með paprikudufti, salti og pipar.", "Kljúfðu kartöflurnar, fylltu með baunum og settu avókadó og lime yfir."],
    prep_time_min: 6, cook_time_min: 45, calories: 580, protein: 22, carbs: 88, fat: 16,
    dietary_tags: ["vegetarian", "vegan", "dairy-free", "gluten-free", "meal-prep"],
  },
  {
    name: "Vegetable frittata with potatoes", name_is: "Grænmetiseggjakaka með kartöflum",
    description: "Eggs, cold potatoes and whatever vegetables need using. One pan.",
    description_is: "Egg, kaldar kartöflur og það grænmeti sem þarf að nota. Ein panna.",
    ingredients: ["8 eggs", "400 g cooked potatoes", "1 onion", "200 g vegetables", "50 g cheese", "1 tbsp oil", "Salt and pepper"],
    ingredients_is: ["8 egg", "400 g soðnar kartöflur", "1 laukur", "200 g grænmeti", "50 g ostur", "1 msk olía", "Salt og pipar"],
    instructions: ["Fry the sliced potatoes, onion and vegetables in an ovenproof pan for eight minutes.", "Whisk the eggs with salt and pepper and pour them over.", "Cheese on top and under the grill for eight minutes until set."],
    instructions_is: ["Steiktu kartöflusneiðar, lauk og grænmeti á ofnfastri pönnu í átta mínútur.", "Þeyttu eggin með salti og pipar og helltu yfir.", "Ostur ofan á og undir grill í átta mínútur þar til hún er hlaupin."],
    prep_time_min: 10, cook_time_min: 18, calories: 520, protein: 32, carbs: 40, fat: 26,
    dietary_tags: ["high-protein", "vegetarian", "gluten-free"],
  },
  {
    name: "Halloumi with roasted vegetables and potatoes", name_is: "Halloumi með ofnbökuðu grænmeti og kartöflum",
    description: "One tray. The halloumi goes on for the last ten minutes so it keeps its bite.",
    description_is: "Ein ofnplata. Halloumi fer á síðustu tíu mínúturnar svo það haldi áferðinni.",
    ingredients: ["250 g halloumi", "600 g potatoes", "2 peppers", "1 courgette", "2 tbsp olive oil", "Salt, pepper, oregano"],
    ingredients_is: ["250 g halloumi", "600 g kartöflur", "2 paprikur", "1 kúrbítur", "2 msk ólífuolía", "Salt, pipar, óreganó"],
    instructions: ["Heat the oven to 210°C and roast the chopped potatoes and vegetables in oil for 30 minutes.", "Slice the halloumi and lay it on top.", "Ten minutes more, until the cheese is golden at the edges."],
    instructions_is: ["Hitaðu ofninn í 210°C og bakaðu saxaðar kartöflur og grænmeti í olíu í 30 mínútur.", "Skerðu halloumi í sneiðar og leggðu ofan á.", "Tíu mínútur í viðbót, þar til osturinn er gylltur á köntunum."],
    prep_time_min: 10, cook_time_min: 40, calories: 600, protein: 28, carbs: 56, fat: 30,
    dietary_tags: ["high-protein", "vegetarian", "gluten-free"],
  },
];

export const SNACK = [
  {
    name: "Edamame with salt", name_is: "Edamame með salti",
    description: "From the freezer, three minutes, eleven grams of protein.",
    description_is: "Úr frystinum, þrjár mínútur og ellefu grömm af próteini.",
    ingredients: ["150 g frozen edamame", "Salt"],
    ingredients_is: ["150 g frosið edamame", "Salt"],
    instructions: ["Boil the edamame for three minutes.", "Drain and salt them.", "Eat the beans, not the pods."],
    instructions_is: ["Sjóddu edamame í þrjár mínútur.", "Helltu vatninu af og saltaðu.", "Borðaðu baunirnar, ekki belgina."],
    prep_time_min: 1, cook_time_min: 4, calories: 190, protein: 16, carbs: 14, fat: 8,
    dietary_tags: ["high-protein", "vegetarian", "vegan", "dairy-free", "gluten-free"],
  },
  {
    name: "Roasted chickpeas", name_is: "Ristaðar kjúklingabaunir",
    description: "A tin, an oven, and something crunchy that is not crisps.",
    description_is: "Ein dós, ofn og eitthvað stökkt sem er ekki snakk.",
    ingredients: ["1 tin chickpeas", "1 tbsp olive oil", "1 tsp paprika", "Salt"],
    ingredients_is: ["1 dós kjúklingabaunir", "1 msk ólífuolía", "1 tsk paprikuduft", "Salt"],
    instructions: ["Rinse and dry the chickpeas well — wet ones steam instead of crisping.", "Toss in oil, paprika and salt on a tray.", "200°C for 25 minutes, shaking the tray once."],
    instructions_is: ["Skolaðu baunirnar og þerraðu þær vel — blautar baunir gufusjóða í stað þess að verða stökkar.", "Veltu þeim í olíu, paprikudufti og salti á ofnplötu.", "200°C í 25 mínútur og hristu plötuna einu sinni."],
    prep_time_min: 5, cook_time_min: 25, calories: 210, protein: 11, carbs: 26, fat: 8,
    dietary_tags: ["vegetarian", "vegan", "dairy-free", "gluten-free", "meal-prep"],
  },
  {
    name: "Oat milk and plant protein shake", name_is: "Jurtapróteinhristingur með haframjólk",
    description: "For the days there is no time for anything that needs a plate.",
    description_is: "Fyrir dagana þegar þú hefur ekki tíma fyrir neitt sem þarf disk.",
    ingredients: ["25 g plant protein powder", "3 dl oat milk", "1 banana"],
    ingredients_is: ["25 g jurtaprótein", "3 dl haframjólk", "1 banani"],
    instructions: ["Everything in the blender.", "Thirty seconds.", "Drink it."],
    instructions_is: ["Allt í blandarann.", "Þrjátíu sekúndur.", "Drekktu."],
    prep_time_min: 2, cook_time_min: 0, calories: 290, protein: 24, carbs: 40, fat: 5,
    dietary_tags: ["high-protein", "vegetarian", "vegan", "dairy-free", "gluten-free", "no-cook"],
  },
];

const CATS = [["breakfast", BREAKFAST], ["lunch", LUNCH], ["dinner", DINNER], ["snack", SNACK]];
const U = "https://cfnibfxzltxiriqxvvru.supabase.co";
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes("--apply");
if (!K) { console.error("SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }

const rest = async (path, init) => {
  const r = await fetch(`${U}/rest/v1/${path}`, { ...init, headers: { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init?.headers ?? {}) } });
  const t = await r.text();
  if (r.status >= 400) throw new Error(`${r.status} ${path}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
};

const existing = await rest("meals?select=id,name_is,name");
const byName = new Map(existing.map((m) => [m.name_is ?? m.name, m]));
const rows = [];
let add = 0, upd = 0;
for (const [category, list] of CATS) for (const m of list) {
  const found = byName.get(m.name_is);
  rows.push({ ...m, category, servings: category === "snack" ? 1 : 2, difficulty: "easy", retired: false, is_filler: false, ...(found ? { id: found.id } : {}) });
  found ? upd++ : add++;
}
console.log(`new: ${add}   overwriting by name: ${upd}`);
if (!apply) { console.log("(dry run — pass --apply)"); process.exit(0); }
const done = await rest("meals?on_conflict=id", { method: "POST", body: JSON.stringify(rows), headers: { Prefer: "return=representation,resolution=merge-duplicates" } });
console.log(`wrote ${done.length} meals`);
