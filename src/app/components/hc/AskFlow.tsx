"use client";

/*
 * Two questions before a message, and a way past them.
 *
 * What arrived in the coach's inbox was "hæ, ég er í vandræðum með
 * æfingarnar", and the first reply was always a question back: which part,
 * since when, does it hurt. Two taps answer most of that before anyone
 * writes anything, and the person gets an opening line they can edit rather
 * than a blank box — which is the harder thing to start with anyway.
 *
 * Three rules it is built around:
 *
 *  1. Nobody is trapped in it. "Skrifa frjálst" is on the first screen and
 *     the composer underneath never stops working. A form people cannot
 *     skip is a form people stop opening.
 *
 *  2. The clinical path does not end at a coach. Blood tests, measurements,
 *     symptoms and medication go to a doctor, with a booking link and the
 *     reason said plainly. A coach reading a blood test back to somebody is
 *     practising medicine, and the old prompt list invited exactly that by
 *     offering "eitthvað í skýrslunni" as a thing to ask a coach about.
 *
 *  3. The answer becomes ordinary Icelandic, not a tag. The chat has no
 *     column for a topic, and inventing "[Æfingar · Verkur]" prefixes would
 *     put machine syntax in a conversation between two people. The opening
 *     line says the same thing in words.
 */

import { useState } from "react";
import { ChevronLeft, ExternalLink, PenLine, Stethoscope } from "lucide-react";

export interface AskTopic {
  key: string;
  label: string;
  hint?: string;
  /** The sharpening question and what it puts in the box. */
  q: string;
  options: { key: string; label: string; opener: string }[];
  /** Clinical: answered by a doctor, not the coach. */
  clinical?: boolean;
}

export const ASK_TOPICS: AskTopic[] = [
  {
    key: "exercise", label: "Æfingar", hint: "Álag, verkir eða eitthvað sem gengur ekki upp",
    q: "Hvað á við?",
    options: [
      { key: "hard", label: "Of erfitt", opener: "Æfingarnar eru þyngri en ég ræð við eins og er. Getum við létt þær?" },
      { key: "easy", label: "Of létt", opener: "Mér finnst æfingarnar of léttar núna. Má ég fá meira að gera?" },
      { key: "pain", label: "Verkur eða óþægindi", opener: "Ég finn fyrir verk þegar ég æfi. " },
      { key: "time", label: "Kemst ekki í æfingu", opener: "Ég kemst ekki í æfingarnar eins og áætlunin gerir ráð fyrir. " },
      { key: "how", label: "Skil ekki æfinguna", opener: "Ég er ekki viss um hvernig ég á að gera eina af æfingunum. " },
    ],
  },
  {
    key: "nutrition", label: "Næring", hint: "Máltíðir, óþol eða ráðleggingar",
    q: "Hvað á við?",
    options: [
      { key: "hard", label: "Erfitt að fylgja", opener: "Mér gengur illa að fylgja næringunni eins og hún er. " },
      { key: "allergy", label: "Óþol eða ofnæmi", opener: "Ég þoli ekki eitthvað sem er í máltíðunum. " },
      { key: "ideas", label: "Vantar hugmyndir", opener: "Mig vantar fleiri hugmyndir að máltíðum. " },
      { key: "advice", label: "Spurning um ráðleggingar", opener: "Ég er með spurningu um næringarráðleggingarnar. " },
    ],
  },
  {
    key: "sleep", label: "Svefn", hint: "Að sofna, vakna eða þreyta á daginn",
    q: "Hvað á við?",
    options: [
      { key: "onset", label: "Erfitt að sofna", opener: "Ég á erfitt með að sofna á kvöldin. " },
      { key: "waking", label: "Vakna upp á nóttunni", opener: "Ég vakna upp á nóttunni og næ illa að sofna aftur. " },
      { key: "short", label: "Of lítill svefn", opener: "Ég næ ekki nógu löngum svefni. " },
      { key: "tired", label: "Þreyta á daginn", opener: "Ég er þreytt/ur á daginn þótt ég sofi. " },
    ],
  },
  {
    key: "mental", label: "Andleg líðan", hint: "Streita, kvíði eða að tala við einhvern",
    q: "Hvað á við?",
    options: [
      { key: "stress", label: "Streita", opener: "Ég finn fyrir mikilli streitu þessa dagana. " },
      { key: "worry", label: "Kvíði", opener: "Ég finn fyrir kvíða. " },
      { key: "flat", label: "Áhugaleysi", opener: "Ég hef lítinn áhuga eða orku í þetta núna. " },
      { key: "talk", label: "Vil tala við einhvern", opener: "Ég vil gjarnan tala við einhvern. " },
    ],
  },
  {
    key: "medical", label: "Niðurstöður eða heilsufar", hint: "Blóðprufa, mælingar, einkenni eða lyf",
    clinical: true,
    q: "Hvað viltu ræða?",
    options: [
      { key: "blood", label: "Blóðprufa", opener: "Mig langar að fara yfir niðurstöðurnar úr blóðprufunni. " },
      { key: "measures", label: "Mælingar", opener: "Mig langar að fara yfir niðurstöðurnar úr mælingunum. " },
      { key: "symptom", label: "Einkenni eða verkir", opener: "Ég er með einkenni sem ég vil láta skoða. " },
      { key: "meds", label: "Lyf", opener: "Ég er með spurningu um lyf. " },
    ],
  },
  {
    key: "booking", label: "Tímar og bókanir", hint: "Bóka, breyta eða afbóka",
    q: "Hvað viltu gera?",
    options: [
      { key: "book", label: "Bóka tíma", opener: "Ég vil bóka tíma. " },
      { key: "move", label: "Breyta tíma", opener: "Ég þarf að færa tíma sem ég á. " },
      { key: "cancel", label: "Afbóka", opener: "Ég kemst ekki í tímann minn. " },
      { key: "ask", label: "Spurning um tíma", opener: "Ég er með spurningu um tímann minn. " },
    ],
  },
];

export default function AskFlow({ onPick, onFree, portalUrl }: {
  /** Puts an opening line in the composer and closes the sheet. */
  onPick: (opener: string) => void;
  /** Straight to the box, no questions. */
  onFree: () => void;
  portalUrl?: string | null;
}) {
  const [topic, setTopic] = useState<AskTopic | null>(null);

  if (!topic) {
    return (
      <div>
        <ul className="divide-y divide-slate-100">
          {ASK_TOPICS.map((t) => (
            <li key={t.key}>
              <button type="button" onClick={() => setTopic(t)}
                className="w-full px-4 py-3.5 text-left transition hover:bg-slate-50">
                <span className="block text-sm font-semibold text-hc-ink">{t.label}</span>
                {t.hint && <span className="mt-0.5 block text-xs leading-snug text-slate-600">{t.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
        {/* The way past the whole thing, in the same list rather than hidden
            at the end of it. */}
        <button type="button" onClick={onFree}
          className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          <PenLine className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
          Skrifa frjálst í staðinn
        </button>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={() => setTopic(null)}
        className="flex items-center gap-1 px-4 pt-3 text-xs font-semibold text-slate-600 hover:text-hc-ink">
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Til baka
      </button>
      <p className="px-4 pb-2 pt-1 text-sm font-semibold text-hc-ink">{topic.q}</p>

      {/* Said before the options, not after: somebody who came here about a
          blood test should know who answers it before they pick anything. */}
      {topic.clinical && (
        <div className="mx-4 mb-2 rounded-xl bg-sky-50 p-3 ring-1 ring-sky-200">
          <p className="flex items-start gap-2 text-sm font-semibold text-sky-900">
            <Stethoscope className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Læknir svarar þessu, ekki þjálfarinn.
          </p>
          <p className="mt-1 text-xs leading-snug text-sky-900/80">
            Þjálfarinn les ekki úr blóðprufum, mælingum eða einkennum. Bókaðu tíma hjá lækni — eða sendu
            skilaboðin og við komum þeim áfram.
          </p>
          {portalUrl && (
            <a href={portalUrl} target="_blank" rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-sky-800">
              Bóka tíma hjá lækni <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </div>
      )}

      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {topic.options.map((o) => (
          <li key={o.key}>
            <button type="button" onClick={() => onPick(o.opener)}
              className="w-full px-4 py-3 text-left transition hover:bg-slate-50">
              <span className="block text-sm font-semibold text-hc-ink">{o.label}</span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-600">{o.opener.trim()}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="px-4 py-3 text-xs text-slate-600">
        Skilaboðin fara í reitinn — þú getur breytt þeim áður en þú sendir.
      </p>
    </div>
  );
}
