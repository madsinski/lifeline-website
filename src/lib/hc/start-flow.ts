// The questions a new person is asked, and what their answers produce.
//
// Pure data, no React, so the flow and the preview cannot disagree about
// what was asked — and so the copy can be read and corrected without
// opening a component.
//
// Three questions, deliberately. A Lazyweb study of 129 onboarding flows
// put the median at 11 screens with health and fitness apps running the
// longest; Lifeline's old sequence reached six screens before the journey
// even began, and then opened a twelve-step journey. The point of asking at
// all is that the answers visibly change what is offered — the Headspace
// pattern — so each question here earns its screen by appearing in the
// preview that follows.

export type GoalKey = "energy" | "weight" | "strength" | "sleep" | "stress" | "prevent";
export type MoveKey = "rarely" | "sometimes" | "often" | "daily";
export type AgeKey = "u30" | "30s" | "45s" | "60p";

export interface StartAnswers {
  goal?: GoalKey;
  move?: MoveKey;
  age?: AgeKey;
}

export const GOALS: { key: GoalKey; label: string; hint: string }[] = [
  { key: "energy", label: "Meiri orka", hint: "Úthald yfir daginn, minni þreyta" },
  { key: "weight", label: "Léttast", hint: "Þyngd og líkamssamsetning" },
  { key: "strength", label: "Styrkur", hint: "Byggja upp vöðva og þol" },
  { key: "sleep", label: "Betri svefn", hint: "Sofna fyrr, vakna úthvíld/ur" },
  { key: "stress", label: "Minni streita", hint: "Ró og andleg líðan" },
  { key: "prevent", label: "Fyrirbyggja", hint: "Vita hvar ég stend og halda því" },
];

export const MOVES: { key: MoveKey; label: string }[] = [
  { key: "rarely", label: "Sjaldan eða aldrei" },
  { key: "sometimes", label: "Einu sinni til tvisvar í viku" },
  { key: "often", label: "Þrisvar til fjórum sinnum" },
  { key: "daily", label: "Nánast daglega" },
];

export const AGES: { key: AgeKey; label: string }[] = [
  { key: "u30", label: "Undir 30" },
  { key: "30s", label: "30–44" },
  { key: "45s", label: "45–59" },
  { key: "60p", label: "60 eða eldri" },
];

/** Sessions a week, from how much they already move. Starting where somebody
 *  is beats starting where a template thinks they should be. */
export function daysPerWeek(move?: MoveKey): number {
  if (move === "rarely") return 2;
  if (move === "sometimes") return 3;
  if (move === "often") return 4;
  return 4;
}

/** What the plan will lead with. The goal decides the headline; the rest of
 *  the pillars are still there, they are simply not the opening move.
 *
 *  Accusative, because the only caller reads "Áhersla á <this>". Splitting a
 *  sentence across a component and a data file is how "svefn og dagleg
 *  hreyfing" shipped — each half correct, the join wrong, and the proofreader
 *  blind to it because it never sees them together. */
export function emphasis(goal?: GoalKey): string {
  switch (goal) {
    case "energy": return "svefn og daglega hreyfingu";
    case "weight": return "næringu og brennslu";
    case "strength": return "styrktarþjálfun og prótein";
    case "sleep": return "svefnrútínu og kvöldvenjur";
    case "stress": return "öndun, hvíld og álagsstjórnun";
    default: return "grunnmælingar og fyrirbyggjandi venjur";
  }
}

/**
 * Whether measurements are worth suggesting.
 *
 * Not a diagnosis and not a gate — "fyrirbyggja" is literally a request to
 * know where you stand, and from 45 the reference bands shift enough that
 * numbers tell you more than a questionnaire can. It changes which route is
 * suggested FIRST; both remain available, because a person who wants
 * coaching should get coaching.
 */
export function suggestsCheck(a: StartAnswers): boolean {
  return a.goal === "prevent" || a.age === "45s" || a.age === "60p";
}

/** Three lines naming what the answers produced, for the preview screen. */
export function previewLines(a: StartAnswers): string[] {
  const d = daysPerWeek(a.move);
  return [
    `${d} æfingar á viku til að byrja með`,
    `Áhersla á ${emphasis(a.goal)}`,
    a.move === "rarely"
      ? "Rólegt upphaf — við byggjum ofan á það sem gengur"
      : "Álagið hækkar eftir því sem þú venst því",
  ];
}

/** Kept until the account exists, so nobody is written to the database for
 *  answering three questions and then changing their mind. */
export const START_KEY = "ll-start-answers";
