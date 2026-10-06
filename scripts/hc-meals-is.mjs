// Everyday Icelandic meals for the heilsuferð plan.
//
// The library this replaces was written protein-first and it showed: the
// breakfasts were chicken pans, tuna-and-egg open sandwiches and cottage
// cheese with smoked salmon — forty grams of protein each and nothing anyone
// here actually eats before work. The lunches were thirty-minute cooked
// dishes, which is not what a working day looks like either.
//
// So: breakfast is skyr, eggs, chia or oats, assembled in ten minutes. Lunch
// is yesterday's dinner reheated or whatever the canteen has, because that is
// what people do. Dinner is the one cooked meal of the day, built on the
// proteins any Bónus or Krónan has — kjúklingabringa, kjúklingalæri,
// nautahakk, nautakjöt, lax, þorskur, lamb — with few ingredients.
//
// Protein is deliberately lower than the old library's. Breakfast carrying
// 44 g was how the day reached 153 g against a 82–109 g band; a slot wants
// roughly its share of the target, not as much as can be crammed in.
//
// Run: node scripts/hc-meals-is.mjs [--apply]
//   Without --apply it prints what it would change and touches nothing.

export const BREAKFAST = [
  {
    name: "Skyr bowl with berries and almonds", name_is: "Skyrskál með berjum og möndlum",
    description: "Plain skyr, frozen berries and a handful of almonds. Thirty seconds of work.",
    description_is: "Hreint skyr, frosin ber og lúka af möndlum. Hálf mínúta af vinnu.",
    ingredients: ["200 g plain skyr", "100 g frozen berries", "20 g almonds", "1 tsp honey (optional)"],
    ingredients_is: ["200 g hreint skyr", "100 g frosin ber", "20 g möndlur", "1 tsk hunang (má sleppa)"],
    instructions: ["Spoon the skyr into a bowl.", "Tip the berries on top — they thaw as you eat.", "Scatter the almonds over and add honey if you want it sweet."],
    instructions_is: ["Settu skyrið í skál.", "Hentu berjunum ofan á — þau þiðna á meðan þú borðar.", "Strá möndlunum yfir og hunangi ef þú vilt hafa það sætt."],
    prep_time_min: 3, cook_time_min: 0, calories: 330, protein: 26, carbs: 32, fat: 10,
    dietary_tags: ["high-protein", "vegetarian", "no-cook", "gluten-free"],
  },
  {
    name: "Soft-boiled eggs on toast with avocado", name_is: "Linsoðin egg með avókadó á ristuðu brauði",
    description: "Two eggs, six and a half minutes, half an avocado mashed onto the toast.",
    description_is: "Tvö egg, sex og hálf mínúta, hálft avókadó stappað á brauðið.",
    ingredients: ["2 eggs", "2 slices sourdough or wholegrain bread", "½ avocado", "Salt and pepper"],
    ingredients_is: ["2 egg", "2 sneiðar af súrdeigs- eða grófu brauði", "½ avókadó", "Salt og pipar"],
    instructions: ["Bring a small pot of water to the boil and lower the eggs in for 6½ minutes.", "Toast the bread while they cook.", "Mash the avocado onto the toast with salt and pepper, and set the eggs on top."],
    instructions_is: ["Láttu vatn sjóða í litlum potti og settu eggin í pottinn í 6½ mínútu.", "Ristaðu brauðið á meðan.", "Stappaðu avókadóinu á brauðið með salti og pipar og settu eggin ofan á."],
    prep_time_min: 3, cook_time_min: 7, calories: 410, protein: 20, carbs: 34, fat: 22,
    dietary_tags: ["vegetarian", "dairy-free"],
  },
  {
    name: "Chia pudding with berries", name_is: "Chiabúðingur með berjum",
    description: "Stirred together the night before; breakfast is already made when you get up.",
    description_is: "Hrært saman kvöldinu áður — morgunmaturinn er til þegar þú vaknar.",
    ingredients: ["3 tbsp chia seeds", "2 dl milk or oat milk", "100 g berries", "½ tsp vanilla", "1 tsp honey (optional)"],
    ingredients_is: ["3 msk chiafræ", "2 dl mjólk eða haframjólk", "100 g ber", "½ tsk vanilla", "1 tsk hunang (má sleppa)"],
    instructions: ["Stir the chia seeds into the milk with the vanilla.", "Leave it in the fridge overnight — it thickens on its own.", "Top with berries in the morning."],
    instructions_is: ["Hrærðu chiafræjunum saman við mjólkina með vanillunni.", "Láttu standa í kæli yfir nótt — það þykknar af sjálfu sér.", "Settu berin ofan á að morgni."],
    prep_time_min: 5, cook_time_min: 0, calories: 300, protein: 12, carbs: 30, fat: 14,
    dietary_tags: ["vegetarian", "no-cook", "gluten-free", "meal-prep"],
  },
  {
    name: "Scrambled eggs with spinach and bread", name_is: "Eggjahræra með spínati og brauði",
    description: "Three eggs, a fistful of spinach, bread alongside. Five minutes on one pan.",
    description_is: "Þrjú egg, lúka af spínati og brauð með. Fimm mínútur á einni pönnu.",
    ingredients: ["3 eggs", "1 handful spinach", "1 tsp butter or oil", "1 slice wholegrain bread", "Salt and pepper"],
    ingredients_is: ["3 egg", "1 lúka spínat", "1 tsk smjör eða olía", "1 sneið gróft brauð", "Salt og pipar"],
    instructions: ["Whisk the eggs with salt and pepper.", "Wilt the spinach in the butter for half a minute, then pour the eggs in.", "Stir over low heat until just set and eat with the bread."],
    instructions_is: ["Þeyttu eggin með salti og pipar.", "Láttu spínatið falla saman í smjörinu í hálfa mínútu og helltu svo eggjunum yfir.", "Hrærðu við lágan hita þar til þau eru rétt hlaupin og borðaðu með brauðinu."],
    prep_time_min: 3, cook_time_min: 5, calories: 360, protein: 24, carbs: 20, fat: 20,
    dietary_tags: ["high-protein", "vegetarian"],
  },
  {
    name: "Skyr bowl with oat granola and apple", name_is: "Skyrskál með hafragranóla og epli",
    description: "Skyr, granola and a chopped apple — crunch without a sugar hit.",
    description_is: "Skyr, granóla og saxað epli — stökkt án sykursprengju.",
    ingredients: ["200 g plain skyr", "30 g oat granola", "1 apple", "1 tsp cinnamon"],
    ingredients_is: ["200 g hreint skyr", "30 g hafragranóla", "1 epli", "1 tsk kanill"],
    instructions: ["Spoon the skyr into a bowl.", "Chop the apple and pile it on with the granola.", "Dust with cinnamon."],
    instructions_is: ["Settu skyrið í skál.", "Saxaðu eplið og settu það yfir með granólanu.", "Sáldraðu kanil yfir."],
    prep_time_min: 4, cook_time_min: 0, calories: 350, protein: 24, carbs: 44, fat: 6,
    dietary_tags: ["high-protein", "vegetarian", "no-cook"],
  },
  {
    name: "Porridge with skyr and banana", name_is: "Hafragrautur með skyri og banana",
    description: "Oats cooked in water, a spoon of skyr stirred in at the end for the protein.",
    description_is: "Hafrar soðnir í vatni. Skyri er hrært saman við í lokin fyrir próteinið.",
    ingredients: ["60 g rolled oats", "3 dl water", "100 g plain skyr", "1 banana", "Pinch of salt"],
    ingredients_is: ["60 g haframjöl", "3 dl vatn", "100 g hreint skyr", "1 banani", "Salt á hnífsoddi"],
    instructions: ["Simmer the oats in the water with the salt for five minutes.", "Take it off the heat and stir the skyr in.", "Slice the banana over the top."],
    instructions_is: ["Sjóddu haframjölið í vatninu með saltinu í fimm mínútur.", "Taktu af hitanum og hrærðu skyrinu saman við.", "Skerðu bananann yfir."],
    prep_time_min: 2, cook_time_min: 6, calories: 400, protein: 20, carbs: 62, fat: 7,
    dietary_tags: ["vegetarian"],
  },
  {
    name: "Boiled eggs, rye bread and avocado", name_is: "Harðsoðin egg, rúgbrauð og avókadó",
    description: "Boil the eggs on Sunday and this takes two minutes any morning.",
    description_is: "Sjóddu eggin á sunnudegi og þá tekur þetta tvær mínútur hvaða morgun sem er.",
    ingredients: ["2 hard-boiled eggs", "1 slice rye bread", "½ avocado", "Salt"],
    ingredients_is: ["2 harðsoðin egg", "1 sneið rúgbrauð", "½ avókadó", "Salt"],
    instructions: ["Slice the avocado onto the rye bread.", "Halve the eggs and lay them on top.", "Salt, and eat."],
    instructions_is: ["Skerðu avókadóið á rúgbrauðið.", "Skerðu eggin í tvennt og leggðu þau ofan á.", "Salta og borða."],
    prep_time_min: 3, cook_time_min: 0, calories: 340, protein: 17, carbs: 26, fat: 19,
    dietary_tags: ["no-cook", "dairy-free", "meal-prep"],
  },
  {
    name: "Chia pudding with cocoa and peanut butter", name_is: "Chiabúðingur með kakói og hnetusmjöri",
    description: "The same overnight pudding, made to taste like dessert.",
    description_is: "Sami búðingurinn yfir nótt, bara með eftirréttarbragði.",
    ingredients: ["3 tbsp chia seeds", "2 dl milk", "1 tbsp cocoa", "1 tbsp peanut butter", "1 tsp honey"],
    ingredients_is: ["3 msk chiafræ", "2 dl mjólk", "1 msk kakó", "1 msk hnetusmjör", "1 tsk hunang"],
    instructions: ["Stir everything but the peanut butter together.", "Leave it in the fridge overnight.", "Swirl the peanut butter through before eating."],
    instructions_is: ["Hrærðu öllu nema hnetusmjörinu saman.", "Láttu standa í kæli yfir nótt.", "Hrærðu hnetusmjörinu í áður en þú borðar."],
    prep_time_min: 5, cook_time_min: 0, calories: 400, protein: 16, carbs: 30, fat: 24,
    dietary_tags: ["vegetarian", "no-cook", "gluten-free", "meal-prep"],
  },
  {
    name: "Omelette with cheese and tomato", name_is: "Eggjakaka með osti og tómötum",
    description: "Three eggs folded over cheese and tomato. One pan, no chopping to speak of.",
    description_is: "Þrjú egg lögð yfir ost og tómata. Ein panna og nánast enginn skurður.",
    ingredients: ["3 eggs", "30 g grated cheese", "1 tomato", "1 tsp butter", "Salt and pepper"],
    ingredients_is: ["3 egg", "30 g rifinn ostur", "1 tómatur", "1 tsk smjör", "Salt og pipar"],
    instructions: ["Whisk the eggs with salt and pepper and pour them into the buttered pan.", "When the edges set, scatter the cheese and sliced tomato over one half.", "Fold it over and slide it onto the plate."],
    instructions_is: ["Þeyttu eggin með salti og pipar og helltu á pönnu með smjörinu.", "Þegar kantarnir hlaupa, settu ostinn og tómatsneiðarnar á aðra hálfuna.", "Leggðu hana yfir og settu á disk."],
    prep_time_min: 3, cook_time_min: 6, calories: 390, protein: 27, carbs: 6, fat: 29,
    dietary_tags: ["high-protein", "vegetarian", "low-carb", "gluten-free"],
  },
  {
    name: "Cottage cheese on crispbread with tomato", name_is: "Kotasæla á hrökkbrauði með tómötum",
    description: "Four minutes, no cooking, and it keeps you going until lunch.",
    description_is: "Fjórar mínútur, engin eldamennska, og það heldur þér gangandi til hádegis.",
    ingredients: ["150 g cottage cheese", "2 crispbreads", "1 tomato", "Salt and pepper"],
    ingredients_is: ["150 g kotasæla", "2 hrökkbrauð", "1 tómatur", "Salt og pipar"],
    instructions: ["Spread the cottage cheese on the crispbread.", "Slice the tomato over it.", "Salt and pepper."],
    instructions_is: ["Smyrðu kotasælunni á hrökkbrauðið.", "Skerðu tómatinn yfir.", "Salt og pipar."],
    prep_time_min: 4, cook_time_min: 0, calories: 260, protein: 22, carbs: 24, fat: 7,
    dietary_tags: ["high-protein", "vegetarian", "no-cook"],
  },
  // These exist because measuring a real plan showed a gluten-free person got
  // none of the quick options above — rye bread, sandwich, crispbread, toast,
  // all of them — and fell back on the thirty-minute cooked dishes, which is
  // the thing this rewrite was meant to stop.
  {
    name: "Scrambled eggs with avocado and tomato", name_is: "Eggjahræra með avókadó og tómötum",
    description: "Eggs and avocado, no bread. Five minutes, naturally gluten-free.",
    description_is: "Egg og avókadó, ekkert brauð. Fimm mínútur og náttúrulega glútenlaust.",
    ingredients: ["3 eggs", "½ avocado", "1 tomato", "1 tsp butter", "Salt and pepper"],
    ingredients_is: ["3 egg", "½ avókadó", "1 tómatur", "1 tsk smjör", "Salt og pipar"],
    instructions: ["Whisk the eggs and scramble them gently in the butter.", "Slice the avocado and tomato onto the plate.", "Salt and pepper over everything."],
    instructions_is: ["Þeyttu eggin og hrærðu þau rólega í smjörinu.", "Skerðu avókadóið og tómatinn á diskinn.", "Salt og pipar yfir allt."],
    prep_time_min: 3, cook_time_min: 5, calories: 350, protein: 22, carbs: 10, fat: 26,
    dietary_tags: ["high-protein", "vegetarian", "gluten-free", "low-carb"] },
  {
    name: "Skyr with peanut butter and banana", name_is: "Skyrskál með hnetusmjöri og banana",
    description: "Three things in a bowl. Gluten-free without trying.",
    description_is: "Þrennt í skál. Glútenlaust án þess að reyna.",
    ingredients: ["200 g plain skyr", "1 tbsp peanut butter", "1 banana", "1 tsp cocoa (optional)"],
    ingredients_is: ["200 g hreint skyr", "1 msk hnetusmjör", "1 banani", "1 tsk kakó (má sleppa)"],
    instructions: ["Spoon the skyr into a bowl.", "Swirl the peanut butter through it.", "Slice the banana over the top."],
    instructions_is: ["Settu skyrið í skál.", "Hrærðu hnetusmjörinu í gegn.", "Skerðu bananann yfir."],
    prep_time_min: 3, cook_time_min: 0, calories: 380, protein: 26, carbs: 38, fat: 12,
    dietary_tags: ["high-protein", "vegetarian", "no-cook", "gluten-free"] },
  {
    name: "Porridge from gluten-free oats with skyr", name_is: "Hafragrautur úr glútenlausum höfrum með skyri",
    description: "Oats are gluten-free in themselves; buy the ones marked so and this is safe.",
    description_is: "Hafrar eru glútenlausir í sjálfu sér — kauptu þá sem eru merktir þannig og þetta er óhætt.",
    ingredients: ["60 g gluten-free oats", "3 dl water", "100 g plain skyr", "100 g berries", "Pinch of salt"],
    ingredients_is: ["60 g glútenlaust haframjöl", "3 dl vatn", "100 g hreint skyr", "100 g ber", "Salt á hnífsoddi"],
    instructions: ["Simmer the oats in the water with the salt for five minutes.", "Stir the skyr in off the heat.", "Berries on top."],
    instructions_is: ["Sjóddu hafrana í vatninu með saltinu í fimm mínútur.", "Hrærðu skyrinu saman við utan hita.", "Ber ofan á."],
    prep_time_min: 2, cook_time_min: 6, calories: 380, protein: 22, carbs: 58, fat: 6,
    dietary_tags: ["vegetarian", "gluten-free"] },
];

// Added after measuring a real plan: these exist because a gluten-free person
// got none of the quick lunches above — rye bread, sandwich, crispbread, all
// of them — and fell back on the thirty-minute cooked dishes, which is the
// thing the rewrite was meant to stop. Lunch depth went 9 of 26 to 14 of 29.

// Lunch is the meal people do not cook. Yesterday's dinner reheated, or
// whatever the canteen put out, or something assembled standing up. A
// thirty-minute lunch recipe is a recipe nobody follows on a Tuesday.
export const LUNCH = [
  {
    name: "Yesterday's dinner, reheated", name_is: "Afgangur frá kvöldmatnum",
    description: "The cheapest, fastest and least wasteful lunch there is. Cook one extra portion at dinner.",
    description_is: "Ódýrasti, fljótlegasti og minnst sóðalegi hádegismaturinn sem til er. Eldaðu einn skammt í viðbót um kvöldið.",
    ingredients: ["1 portion of last night's dinner", "Extra vegetables or salad if it is light on them"],
    ingredients_is: ["1 skammtur af kvöldmatnum í gær", "Meira grænmeti eða salat ef lítið er af því"],
    instructions: ["Pack a portion straight into a box while you are serving dinner — not after the washing up.", "Reheat it at work, or eat it cold if it works cold.", "Add salad or raw vegetables if the dish is short on them."],
    instructions_is: ["Settu einn skammt í box um leið og þú skammtar kvöldmatinn — ekki eftir uppvaskið.", "Hitaðu í vinnunni, eða borðaðu kalt ef það gengur kalt.", "Hafðu salat eða hrátt grænmeti með ef lítið grænmeti er í réttinum."],
    prep_time_min: 2, cook_time_min: 0, calories: 550, protein: 38, carbs: 45, fat: 22,
    dietary_tags: ["high-protein", "no-cook", "meal-prep"],
  },
  {
    name: "Canteen: fish of the day with potatoes", name_is: "Mötuneyti: fiskur dagsins með kartöflum",
    description: "If your workplace serves lunch, this is usually the best thing on the counter.",
    description_is: "Ef vinnustaðurinn þinn er með mötuneyti er þetta oftast það besta á borðinu.",
    ingredients: ["Fish of the day", "Potatoes or rice", "Whatever vegetables are out", "Salad from the bar"],
    ingredients_is: ["Fiskur dagsins", "Kartöflur eða hrísgrjón", "Það grænmeti sem er í boði", "Salat af salatbarnum"],
    instructions: ["Take the fish rather than the fried option when both are there.", "Fill a third of the plate with vegetables or salad before you take the potatoes.", "Skip the second helping of sauce — that is usually where the calories are."],
    instructions_is: ["Taktu fiskinn fremur en það sem er steikt, þegar bæði er í boði.", "Fylltu þriðjung disksins með grænmeti eða salati áður en þú tekur kartöflurnar.", "Slepptu annarri ferð í sósuna — þar eru hitaeiningarnar oftast."],
    prep_time_min: 0, cook_time_min: 0, calories: 560, protein: 36, carbs: 50, fat: 20,
    dietary_tags: ["high-protein", "no-cook"],
  },
  {
    name: "Canteen: home cooking with vegetables", name_is: "Mötuneyti: heimilismatur með grænmeti",
    description: "Meatballs, stew, fish gratin — the trick is the plate, not the dish.",
    description_is: "Kjötbollur, pottréttur, fiskigratín — það er diskurinn sem skiptir máli, ekki rétturinn.",
    ingredients: ["The hot dish of the day", "Potatoes, rice or pasta", "Salad or boiled vegetables"],
    ingredients_is: ["Heiti rétturinn dagsins", "Kartöflur, hrísgrjón eða pasta", "Salat eða soðið grænmeti"],
    instructions: ["Serve yourself the protein first, then the vegetables, then the starch — whatever space is left.", "Water rather than juice or soda.", "If there is skyr or fruit for afters, that is the one to take."],
    instructions_is: ["Skammtaðu þér próteinið fyrst, svo grænmetið og síðast kolvetnin — í það sem eftir er.", "Vatn fremur en safi eða gos.", "Ef skyr eða ávextir eru í eftirmat skaltu taka það."],
    prep_time_min: 0, cook_time_min: 0, calories: 620, protein: 32, carbs: 60, fat: 24,
    dietary_tags: ["no-cook"],
  },
  {
    name: "Chicken and vegetable salad bowl", name_is: "Salatskál með kjúklingi",
    description: "Cooked chicken from the fridge, salad, and whatever is in the drawer. No heat.",
    description_is: "Eldaður kjúklingur úr kæli, salat og það sem er í grænmetisskúffunni. Enginn hiti.",
    ingredients: ["150 g cooked chicken", "100 g salad leaves", "½ cucumber", "1 tomato", "1 tbsp olive oil", "Salt and pepper"],
    ingredients_is: ["150 g eldaður kjúklingur", "100 g salatblöð", "½ gúrka", "1 tómatur", "1 msk ólífuolía", "Salt og pipar"],
    instructions: ["Tear the salad into a box or bowl.", "Chop the cucumber and tomato in and lay the chicken over.", "Oil, salt and pepper, lid on."],
    instructions_is: ["Rífðu salatið í box eða skál.", "Saxaðu gúrkuna og tómatinn með og leggðu kjúklinginn yfir.", "Olía, salt og pipar og loka boxinu."],
    prep_time_min: 8, cook_time_min: 0, calories: 420, protein: 38, carbs: 12, fat: 24,
    dietary_tags: ["high-protein", "no-cook", "low-carb", "gluten-free", "dairy-free"],
  },
  {
    name: "Rye bread with egg and tomato", name_is: "Rúgbrauð með eggjum og tómötum",
    description: "Two slices, two eggs from the Sunday batch, done standing at the counter.",
    description_is: "Tvær sneiðar og tvö egg úr sunnudagspottinum, afgreitt standandi við borðið.",
    ingredients: ["2 slices rye bread", "2 hard-boiled eggs", "1 tomato", "Butter", "Salt and pepper"],
    ingredients_is: ["2 sneiðar rúgbrauð", "2 harðsoðin egg", "1 tómatur", "Smjör", "Salt og pipar"],
    instructions: ["Butter the bread.", "Slice the eggs and tomato over it.", "Salt and pepper."],
    instructions_is: ["Smyrðu brauðið.", "Skerðu eggin og tómatinn yfir.", "Salt og pipar."],
    prep_time_min: 5, cook_time_min: 0, calories: 420, protein: 22, carbs: 42, fat: 18,
    dietary_tags: ["vegetarian", "no-cook"],
  },
  {
    name: "Ham and cheese sandwich with vegetables", name_is: "Samloka með skinku, osti og grænmeti",
    description: "An honest sandwich. Make it the night before and it is better by lunch.",
    description_is: "Heiðarleg samloka. Gerðu hana kvöldinu áður og hún er betri í hádeginu.",
    ingredients: ["2 slices wholegrain bread", "80 g ham", "30 g cheese", "Lettuce", "1 tomato", "Butter"],
    ingredients_is: ["2 sneiðar gróft brauð", "80 g skinka", "30 g ostur", "Salat", "1 tómatur", "Smjör"],
    instructions: ["Butter both slices so the tomato does not soak the bread.", "Layer ham, cheese, lettuce and tomato.", "Wrap it and put it in the fridge."],
    instructions_is: ["Smyrðu báðar sneiðarnar svo tómaturinn vökni ekki inn í brauðið.", "Leggðu skinku, ost, salat og tómat í lög.", "Pakkaðu henni og settu í kæli."],
    prep_time_min: 6, cook_time_min: 0, calories: 480, protein: 30, carbs: 40, fat: 22,
    dietary_tags: ["high-protein", "no-cook", "meal-prep"],
  },
  {
    name: "Tuna salad on rye", name_is: "Túnfisksalat á rúgbrauði",
    description: "A tin, a spoon of skyr instead of mayonnaise, and bread.",
    description_is: "Ein dós, skyr í staðinn fyrir majónes og brauð.",
    ingredients: ["1 tin tuna in water", "2 tbsp plain skyr", "¼ red onion", "2 slices rye bread", "Salt and pepper"],
    ingredients_is: ["1 dós túnfiskur í vatni", "2 msk hreint skyr", "¼ rauðlaukur", "2 sneiðar rúgbrauð", "Salt og pipar"],
    instructions: ["Drain the tuna and mash it with the skyr.", "Chop the onion in finely.", "Pile it onto the bread with salt and pepper."],
    instructions_is: ["Helltu vatninu af túnfiskinum og stappaðu hann með skyrinu.", "Saxaðu laukinn smátt og hrærðu saman við.", "Settu á brauðið með salti og pipar."],
    prep_time_min: 7, cook_time_min: 0, calories: 400, protein: 36, carbs: 40, fat: 8,
    dietary_tags: ["high-protein", "no-cook"],
  },
  {
    name: "Soup from the freezer with bread", name_is: "Súpa úr frystinum með brauði",
    description: "Make a big pot once, freeze it in portions, and lunch is solved for a fortnight.",
    description_is: "Eldaðu einn stóran pott, frystu í skömmtum og hádegismaturinn er leystur í hálfan mánuð.",
    ingredients: ["1 frozen portion of meat or fish soup", "1 slice bread", "Butter"],
    ingredients_is: ["1 frosinn skammtur af kjöt- eða fiskisúpu", "1 sneið brauð", "Smjör"],
    instructions: ["Take a portion out of the freezer the night before.", "Reheat it until it steams through.", "Bread and butter on the side."],
    instructions_is: ["Taktu skammt úr frystinum kvöldinu áður.", "Hitaðu þar til rýkur úr henni.", "Brauð og smjör með."],
    prep_time_min: 3, cook_time_min: 6, calories: 480, protein: 28, carbs: 44, fat: 20,
    dietary_tags: ["meal-prep"],
  },

  // These exist because measuring a real plan showed a gluten-free person got
  // none of the quick options above — rye bread, sandwich, crispbread, toast,
  // all of them — and fell back on the thirty-minute cooked dishes, which is
  // the thing this rewrite was meant to stop.
  {
    name: "Potato and chicken salad", name_is: "Kartöflusalat með kjúklingi",
    description: "Cold potatoes from yesterday, chicken, and a spoon of skyr instead of mayonnaise.",
    description_is: "Kaldar kartöflur frá í gær, kjúklingur og skyr í staðinn fyrir majónes.",
    ingredients: ["300 g cooked potatoes", "150 g cooked chicken", "2 tbsp plain skyr", "¼ red onion", "Chives", "Salt and pepper"],
    ingredients_is: ["300 g soðnar kartöflur", "150 g eldaður kjúklingur", "2 msk hreint skyr", "¼ rauðlaukur", "Graslaukur", "Salt og pipar"],
    instructions: ["Chop the cold potatoes and the chicken into a box.", "Stir the skyr through with the finely chopped onion.", "Chives, salt and pepper."],
    instructions_is: ["Saxaðu köldu kartöflurnar og kjúklinginn í box.", "Hrærðu skyrinu saman við með smátt söxuðum lauk.", "Graslaukur, salt og pipar."],
    prep_time_min: 8, cook_time_min: 0, calories: 430, protein: 34, carbs: 38, fat: 12,
    dietary_tags: ["high-protein", "no-cook", "gluten-free", "meal-prep"] },
  {
    name: "Rice bowl with egg and vegetables", name_is: "Hrísgrjónaskál með eggjum og grænmeti",
    description: "Cold rice from yesterday, two eggs, whatever vegetables are in the drawer.",
    description_is: "Köld hrísgrjón frá í gær, tvö egg og það grænmeti sem til er.",
    ingredients: ["200 g cooked rice", "2 eggs", "½ cucumber", "1 carrot", "1 tbsp sesame-free oil", "Salt and pepper"],
    ingredients_is: ["200 g soðin hrísgrjón", "2 egg", "½ gúrka", "1 gulrót", "1 msk olía", "Salt og pipar"],
    instructions: ["Boil the eggs for 8 minutes, or use ones already boiled.", "Grate the carrot and chop the cucumber into the rice.", "Halve the eggs over the top, oil, salt and pepper."],
    instructions_is: ["Sjóddu eggin í 8 mínútur, eða notaðu egg sem eru þegar soðin.", "Rífðu gulrótina og saxaðu gúrkuna saman við hrísgrjónin.", "Skerðu eggin í tvennt ofan á, olía, salt og pipar."],
    prep_time_min: 7, cook_time_min: 8, calories: 420, protein: 20, carbs: 52, fat: 14,
    dietary_tags: ["vegetarian", "gluten-free", "meal-prep"] },
  {
    name: "Tuna and egg salad bowl", name_is: "Salatskál með túnfiski og eggjum",
    description: "A tin, two eggs, salad. No bread, no cooking, five minutes.",
    description_is: "Ein dós, tvö egg og salat. Ekkert brauð, engin eldamennska, fimm mínútur.",
    ingredients: ["1 tin tuna in water", "2 hard-boiled eggs", "100 g salad leaves", "1 tomato", "1 tbsp olive oil", "Salt and pepper"],
    ingredients_is: ["1 dós túnfiskur í vatni", "2 harðsoðin egg", "100 g salatblöð", "1 tómatur", "1 msk ólífuolía", "Salt og pipar"],
    instructions: ["Tear the salad into a bowl and drain the tuna over it.", "Halve the eggs and lay them on.", "Tomato, oil, salt and pepper."],
    instructions_is: ["Rífðu salatið í skál og helltu túnfisknum yfir.", "Skerðu eggin í tvennt og leggðu þau á.", "Tómatur, olía, salt og pipar."],
    prep_time_min: 6, cook_time_min: 0, calories: 390, protein: 36, carbs: 8, fat: 22,
    dietary_tags: ["high-protein", "no-cook", "gluten-free", "low-carb", "dairy-free"] },
];

// Dinner is the one meal that gets cooked, so it is the one worth cooking
// properly — but on a weeknight that means five or six ingredients and one
// pan or one tray. Every protein here is on the shelf in any Bónus or
// Krónan. Each makes two portions on purpose: the second one is tomorrow's
// lunch, which is what "Afgangur frá kvöldmatnum" above is counting on.
export const DINNER = [
  {
    name: "Chicken breast with potatoes and broccoli", name_is: "Kjúklingabringa með kartöflum og brokkolí",
    description: "The plainest good dinner there is. One tray, forty minutes, nothing to watch.",
    description_is: "Einfaldasti góði kvöldmaturinn sem til er. Ein ofnplata, fjörutíu mínútur og ekkert að vakta.",
    ingredients: ["2 chicken breasts", "600 g potatoes", "1 head broccoli", "2 tbsp olive oil", "Salt, pepper, paprika"],
    ingredients_is: ["2 kjúklingabringur", "600 g kartöflur", "1 brokkolíhöfuð", "2 msk ólífuolía", "Salt, pipar, paprika"],
    instructions: ["Heat the oven to 200°C. Halve the potatoes and toss them in oil, salt and pepper on a tray.", "After 20 minutes push them aside, lay the chicken on with paprika, and add the broccoli.", "Another 18–20 minutes, until the chicken is 72°C in the middle."],
    instructions_is: ["Hitaðu ofninn í 200°C. Skerðu kartöflurnar í tvennt og veltu þeim í olíu, salti og pipar á ofnplötu.", "Eftir 20 mínútur, ýttu þeim til hliðar, leggðu bringurnar á með papriku og settu brokkolíið með.", "Aðrar 18–20 mínútur, þar til kjúklingurinn er 72°C í miðjunni."],
    prep_time_min: 10, cook_time_min: 40, calories: 560, protein: 46, carbs: 48, fat: 18,
    dietary_tags: ["high-protein", "dairy-free", "gluten-free", "meal-prep"],
  },
  {
    name: "Chicken thighs on a tray with root vegetables", name_is: "Kjúklingalæri á ofnplötu með rótargrænmeti",
    description: "Boneless thighs are cheaper than breast, harder to dry out and taste of more.",
    description_is: "Úrbeinuð læri eru ódýrari en bringur, erfiðara að þurrka þau og þau hafa meira bragð.",
    ingredients: ["600 g boneless chicken thighs", "2 carrots", "½ swede or 2 parsnips", "400 g potatoes", "2 tbsp oil", "Salt, pepper, thyme"],
    ingredients_is: ["600 g úrbeinuð kjúklingalæri", "2 gulrætur", "½ gulrófa eða 2 nípur", "400 g kartöflur", "2 msk olía", "Salt, pipar, timjan"],
    instructions: ["Heat the oven to 210°C. Cut the vegetables into chunks and spread them on a tray with oil and salt.", "Lay the thighs skin-side up on top and season.", "35–40 minutes, until the vegetables are soft and the thighs are browned."],
    instructions_is: ["Hitaðu ofninn í 210°C. Skerðu grænmetið í bita og breiddu á plötu með olíu og salti.", "Leggðu lærin ofan á og kryddaðu.", "35–40 mínútur, þar til grænmetið er mjúkt og lærin brúnuð."],
    prep_time_min: 12, cook_time_min: 40, calories: 620, protein: 42, carbs: 44, fat: 28,
    dietary_tags: ["high-protein", "dairy-free", "gluten-free", "meal-prep"],
  },
  {
    name: "Beef mince with pasta and tomato", name_is: "Nautahakk með pasta og tómatsósu",
    description: "Mince, a tin of tomatoes, an onion. Twenty-five minutes and children eat it.",
    description_is: "Hakk, dós af tómötum og laukur. Tuttugu og fimm mínútur og börn borða það.",
    ingredients: ["500 g beef mince", "1 onion", "1 tin chopped tomatoes", "2 cloves garlic", "300 g pasta", "Salt, pepper, oregano"],
    ingredients_is: ["500 g nautahakk", "1 laukur", "1 dós niðursaxaðir tómatar", "2 hvítlauksgeirar", "300 g pasta", "Salt, pipar, óreganó"],
    instructions: ["Brown the mince in a hot pan and break it up as it goes.", "Add the chopped onion and garlic, then the tomatoes, and simmer 15 minutes.", "Boil the pasta meanwhile and stir the two together."],
    instructions_is: ["Brúnaðu hakkið á heitri pönnu og brjóttu það niður á meðan.", "Settu saxaðan lauk og hvítlauk með, svo tómatana, og láttu malla í 15 mínútur.", "Sjóddu pastað á meðan og hrærðu því saman við."],
    prep_time_min: 8, cook_time_min: 25, calories: 640, protein: 42, carbs: 62, fat: 24,
    dietary_tags: ["high-protein", "dairy-free", "meal-prep"],
  },
  {
    name: "Meatballs with potato mash and peas", name_is: "Hakkbollur með kartöflumús og grænum baunum",
    description: "Sunday food on a Wednesday. Make double and freeze half raw.",
    description_is: "Sunnudagsmatur á miðvikudegi. Gerðu tvöfalt og frystu helminginn hráan.",
    ingredients: ["500 g beef mince", "1 egg", "1 onion", "2 tbsp breadcrumbs", "700 g potatoes", "200 g peas", "Butter, milk, salt, pepper"],
    ingredients_is: ["500 g nautahakk", "1 egg", "1 laukur", "2 msk brauðrasp", "700 g kartöflur", "200 g grænar baunir", "Smjör, mjólk, salt, pipar"],
    instructions: ["Mix the mince with the egg, grated onion, breadcrumbs, salt and pepper and roll into balls.", "Fry them over medium heat for 12–14 minutes, turning.", "Boil and mash the potatoes with butter and milk; heat the peas through."],
    instructions_is: ["Hrærðu hakkið með egginu, rifnum lauk, brauðraspi, salti og pipar og rúllaðu í bollur.", "Steiktu þær við miðlungshita í 12–14 mínútur og snúðu þeim.", "Sjóddu og stappaðu kartöflurnar með smjöri og mjólk og hitaðu baunirnar."],
    prep_time_min: 15, cook_time_min: 25, calories: 680, protein: 42, carbs: 58, fat: 30,
    dietary_tags: ["high-protein", "meal-prep"],
  },
  {
    name: "Pan-fried beef with potatoes and salad", name_is: "Nautasteik á pönnu með kartöflum og salati",
    description: "A piece of beef, salted, a hot pan, and left alone. The rest is potatoes.",
    description_is: "Nautastykki, saltað, heit panna og látið í friði. Hitt eru kartöflur.",
    ingredients: ["2 beef steaks (about 180 g each)", "600 g small potatoes", "100 g salad leaves", "1 tbsp butter", "Salt and pepper"],
    ingredients_is: ["2 nautasteikur (um 180 g hver)", "600 g smáar kartöflur", "100 g salatblöð", "1 msk smjör", "Salt og pipar"],
    instructions: ["Boil the potatoes. Take the steaks out of the fridge and salt them while they cook.", "Sear the steaks 3 minutes a side in a very hot pan, then add the butter and spoon it over.", "Rest them five minutes — that is not optional — and serve with the potatoes and salad."],
    instructions_is: ["Sjóddu kartöflurnar. Taktu steikurnar úr kæli og saltaðu þær á meðan.", "Steiktu þær 3 mínútur á hlið á mjög heitri pönnu, settu þá smjörið á og ausaðu því yfir.", "Láttu þær hvíla í fimm mínútur — það má ekki sleppa — og framreiddu með kartöflum og salati."],
    prep_time_min: 8, cook_time_min: 25, calories: 620, protein: 46, carbs: 42, fat: 28,
    dietary_tags: ["high-protein", "gluten-free"],
  },
  {
    name: "Pan-fried salmon with potatoes and vegetables", name_is: "Lax á pönnu með kartöflum og grænmeti",
    description: "Skin down, four minutes, turn once. The most forgiving fish there is.",
    description_is: "Húðin niður, fjórar mínútur, snúið einu sinni. Sá fiskur sem þolir mest.",
    ingredients: ["2 salmon fillets", "600 g potatoes", "200 g green beans or broccoli", "1 tbsp butter", "½ lemon", "Salt and pepper"],
    ingredients_is: ["2 laxabitar", "600 g kartöflur", "200 g grænar baunir eða brokkolí", "1 msk smjör", "½ sítróna", "Salt og pipar"],
    instructions: ["Boil the potatoes and the vegetables.", "Salt the salmon and lay it skin-side down in a hot pan for 4 minutes, then 2 minutes on the flesh side.", "Butter in the pan, squeeze the lemon over, spoon it onto the fish."],
    instructions_is: ["Sjóddu kartöflurnar og grænmetið.", "Saltaðu laxinn og leggðu hann með húðina niður á heita pönnu í 4 mínútur, svo 2 mínútur á hina hliðina.", "Smjör á pönnuna, kreistu sítrónuna yfir og ausaðu yfir fiskinn."],
    prep_time_min: 8, cook_time_min: 22, calories: 600, protein: 42, carbs: 42, fat: 26,
    dietary_tags: ["high-protein", "gluten-free", "meal-prep"],
  },
  {
    name: "Cod baked in butter with potatoes", name_is: "Þorskur í ofni með smjöri og kartöflum",
    description: "Cod, butter, salt, oven. Fifteen minutes and it is better than most restaurants manage.",
    description_is: "Þorskur, smjör, salt, ofn. Fimmtán mínútur og betra en flestir staðir gera.",
    ingredients: ["600 g cod fillet", "2 tbsp butter", "600 g potatoes", "1 tomato", "½ lemon", "Salt and pepper"],
    ingredients_is: ["600 g þorskhnakki", "2 msk smjör", "600 g kartöflur", "1 tómatur", "½ sítróna", "Salt og pipar"],
    instructions: ["Heat the oven to 200°C and put the potatoes on to boil.", "Lay the cod in a dish, dot the butter over, salt it and squeeze the lemon on.", "15–18 minutes, until it flakes when you push it with a fork."],
    instructions_is: ["Hitaðu ofninn í 200°C og settu kartöflurnar í pott.", "Leggðu þorskinn í eldfast mót, settu smjörklípur yfir, saltaðu og kreistu sítrónuna yfir.", "15–18 mínútur, þar til hann flagnar þegar þú ýtir á hann með gaffli."],
    prep_time_min: 7, cook_time_min: 20, calories: 520, protein: 44, carbs: 42, fat: 18,
    dietary_tags: ["high-protein", "gluten-free", "low-carb"],
  },
  {
    name: "Lamb chops with potatoes and green beans", name_is: "Lambakótilettur með kartöflum og grænum baunum",
    description: "Icelandic lamb needs salt, a hot pan and nothing else.",
    description_is: "Íslenskt lambakjöt þarf salt, heita pönnu og ekkert annað.",
    ingredients: ["6 lamb chops", "600 g potatoes", "200 g green beans", "1 tbsp butter", "Salt, pepper, thyme"],
    ingredients_is: ["6 lambakótilettur", "600 g kartöflur", "200 g grænar baunir", "1 msk smjör", "Salt, pipar, timjan"],
    instructions: ["Boil the potatoes and beans.", "Salt the chops and fry them 3–4 minutes a side in a hot pan with the butter and thyme.", "Rest them a few minutes before serving."],
    instructions_is: ["Sjóddu kartöflurnar og baunirnar.", "Saltaðu kótiletturnar og steiktu 3–4 mínútur á hlið á heitri pönnu með smjörinu og timjaninu.", "Láttu þær hvíla í nokkrar mínútur fyrir framreiðslu."],
    prep_time_min: 8, cook_time_min: 25, calories: 660, protein: 42, carbs: 42, fat: 34,
    dietary_tags: ["high-protein", "gluten-free"],
  },
  {
    name: "Chicken thigh curry with rice", name_is: "Kjúklingalærakarrí með hrísgrjónum",
    description: "Thighs, curry paste, a tin of coconut milk. One pot, and better the next day.",
    description_is: "Læri, karrímauk og dós af kókosmjólk. Einn pottur og betra daginn eftir.",
    ingredients: ["600 g boneless chicken thighs", "2 tbsp curry paste", "1 tin coconut milk", "1 onion", "200 g vegetables", "300 g rice"],
    ingredients_is: ["600 g úrbeinuð kjúklingalæri", "2 msk karrímauk", "1 dós kókosmjólk", "1 laukur", "200 g grænmeti", "300 g hrísgrjón"],
    instructions: ["Brown the chicken in chunks, then add the onion and curry paste for a minute.", "Pour the coconut milk in with the vegetables and simmer 15 minutes.", "Boil the rice while it cooks."],
    instructions_is: ["Brúnaðu kjúklinginn í bitum, settu þá laukinn og karrímaukið með í eina mínútu.", "Helltu kókosmjólkinni yfir með grænmetinu og láttu malla í 15 mínútur.", "Sjóddu hrísgrjónin á meðan."],
    prep_time_min: 10, cook_time_min: 25, calories: 650, protein: 40, carbs: 56, fat: 28,
    dietary_tags: ["high-protein", "dairy-free", "gluten-free", "meal-prep"],
  },
  {
    name: "Beef mince and sweet potato in a pan", name_is: "Nautahakk og sætar kartöflur á pönnu",
    description: "Everything in one pan, nothing measured, twenty minutes.",
    description_is: "Allt á einni pönnu, ekkert mælt, tuttugu mínútur.",
    ingredients: ["500 g beef mince", "2 sweet potatoes", "1 onion", "1 pepper", "1 tsp paprika", "Salt and pepper"],
    ingredients_is: ["500 g nautahakk", "2 sætar kartöflur", "1 laukur", "1 paprika", "1 tsk paprika", "Salt og pipar"],
    instructions: ["Dice the sweet potato small and fry it for 10 minutes with the onion.", "Push it aside, brown the mince, then stir everything together.", "Paprika, salt and pepper, two minutes more."],
    instructions_is: ["Skerðu sætu kartöflurnar í litla bita og steiktu í 10 mínútur með lauknum.", "Ýttu þeim til hliðar, brúnaðu hakkið og hrærðu svo öllu saman.", "Paprika, salt og pipar og tvær mínútur í viðbót."],
    prep_time_min: 10, cook_time_min: 22, calories: 580, protein: 40, carbs: 44, fat: 24,
    dietary_tags: ["high-protein", "dairy-free", "gluten-free", "meal-prep"],
  },
];

/**
 * Breakfasts nobody here eats before work.
 *
 * Retired rather than deleted: the library is shared with lifeline-app and
 * meal_log rows point at these by name, so deleting one would orphan real
 * history. Retiring takes them out of new plans and leaves them readable.
 *
 * The cooked "lunches" — turkey chili, lentil soup, oven-baked chicken — are
 * NOT in this list even though they are really dinners. Retiring them would
 * take two of the three vegan lunches with them. They sink on their own now
 * that a lunch is scored partly on how long it takes.
 */
export const RETIRE = [
  "Beygla með reyktum laxi",
  "Kotasæla með reyktum laxi",
  "Lax og hrærð egg",
  "Morgunpanna með kjúklingi",
  "Opin samloka með túnfiski og eggi",
  "Rúgbrauð með reyktum laxi",
  "Heilhveitibeygla með kalkún og avókadó",
  "Kotasælulummur",
];

const CATS = [["breakfast", BREAKFAST], ["lunch", LUNCH], ["dinner", DINNER]];
const U = "https://cfnibfxzltxiriqxvvru.supabase.co";
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes("--apply");

if (!K) { console.error("SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }

const rest = async (path, init) => {
  const r = await fetch(`${U}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init?.headers ?? {}) },
  });
  const body = await r.text();
  if (r.status >= 400) throw new Error(`${r.status} ${path}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : null;
};

const existing = await rest("meals?select=id,name,name_is,category,retired");
const byName = new Map(existing.map((m) => [m.name_is ?? m.name, m]));

let add = 0, update = 0;
const rows = [];
for (const [category, list] of CATS) {
  for (const m of list) {
    const found = byName.get(m.name_is);
    rows.push({ ...m, category, servings: 2, difficulty: "easy", retired: false, is_filler: false, ...(found ? { id: found.id } : {}) });
    if (found) update++; else add++;
  }
}

const toRetire = RETIRE.filter((n) => byName.has(n) && !byName.get(n).retired);
const missing = RETIRE.filter((n) => !byName.has(n));

console.log(`library now: ${existing.length} meals (${existing.filter((m) => m.retired).length} retired)`);
console.log(`new meals to insert: ${add}`);
console.log(`existing names to overwrite: ${update}`);
console.log(`to retire: ${toRetire.length}${missing.length ? `  ⚠ not found: ${missing.join(", ")}` : ""}`);

if (missing.length) {
  console.error("\nA name in RETIRE does not exist. Fix the list rather than leaving it to rot.");
  process.exit(1);
}

if (!apply) { console.log("\n(dry run — pass --apply to write)"); process.exit(0); }

const back = await rest("meals?select=*");
const { writeFileSync } = await import("node:fs");
writeFileSync(new URL("./.meals-backup.json", import.meta.url), JSON.stringify(back, null, 1));
console.log(`\nbacked up ${back.length} rows to scripts/.meals-backup.json`);

const done = await rest("meals?on_conflict=id", { method: "POST", body: JSON.stringify(rows), headers: { Prefer: "return=representation,resolution=merge-duplicates" } });
console.log(`wrote ${done.length} meals`);

for (const n of toRetire) {
  await rest(`meals?id=eq.${byName.get(n).id}`, { method: "PATCH", body: JSON.stringify({ retired: true }) });
}
console.log(`retired ${toRetire.length}`);

const after = await rest("meals?select=category,retired");
const live = after.filter((m) => !m.retired);
const per = (c) => live.filter((m) => m.category === c).length;
console.log(`\nlive library: ${live.length} of ${after.length}  —  breakfast ${per("breakfast")}, lunch ${per("lunch")}, snack ${per("snack")}, dinner ${per("dinner")}`);
