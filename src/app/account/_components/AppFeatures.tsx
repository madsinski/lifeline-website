"use client";

// What is in the Lifeline app: the feature grid and the four pillars.
// One icon set (lucide) instead of three.

import type { LucideIcon } from "lucide-react";
import { Apple, BookOpen, Dumbbell, Gauge, Handshake, ListChecks, Moon, Smile, TrendingUp, UserRound, UsersRound, Utensils, Watch } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SectionCard, accountInset } from "@/app/components/account/ui";

type T = (k: string, f?: string) => string;

const PILLARS = (t: T): Array<{ title: string; desc: string; icon: LucideIcon; tone: string }> => [
  { title: t("acc.pillar.exercise", "Hreyfing"), desc: t("acct.p.styrkur-thol-og-hreyfing-progromm", "Styrkur, þol og hreyfing — prógrömm sniðin að þér."), icon: Dumbbell, tone: "bg-hc-exercise-soft text-hc-exercise-ink" },
  { title: t("acct.p.naering", "Næring"), desc: t("acct.p.radgjof-byggd-a-blodgildum-markmid", "Ráðgjöf byggð á blóðgildum, markmiðum og næringarskiptingu."), icon: Apple, tone: "bg-hc-nutrition-soft text-hc-nutrition-ink" },
  { title: t("acc.pillar.sleep", "Svefn"), desc: t("acct.p.betri-hvild-med-takti-venjum", "Betri hvíld með takti, venjum og umhverfi."), icon: Moon, tone: "bg-hc-sleep-soft text-hc-sleep-ink" },
  { title: t("acct.p.andleg-lidan", "Andleg líðan"), desc: t("acct.p.nuvitund-ondun-alagsstjornun-og-se", "Núvitund, öndun, álagsstjórnun og seigla."), icon: Smile, tone: "bg-hc-mental-soft text-hc-mental-ink" },
];

const FEATURES = (t: T): Array<{ title: string; desc: string; icon: LucideIcon }> => [
  { title: t("acct.p.daglegar-adgerdir", "Daglegar aðgerðir"), desc: t("acct.p.litil-og-athreifanleg-skref-a", "Lítil og áþreifanleg skref á hverjum degi — valin til að hreyfa við þínum tölum."), icon: ListChecks },
  { title: t("acct.p.thjalfarinn-thinn", "Þjálfarinn þinn"), desc: t("acct.p.manneskja-sem-fylgist-med-ther", "Manneskja sem fylgist með þér — áætlanir, breytingar, reglulegt yfirlit og bein skilaboð þegar þig vantar ráð."), icon: UserRound },
  { title: t("acct.p.aefingafelagi", "Æfingafélagi"), desc: t("acct.p.taktu-hondum-saman-vid-vin", "Taktu höndum saman við vin eða samstarfsmann. Sameiginleg röð og mildar áminningar — venjur festast hraðar í félagsskap."), icon: Handshake },
  { title: t("acct.p.samfelag-og-vidburdir", "Samfélag og viðburðir"), desc: t("acct.p.taktu-thatt-i-askorunum-hoptimum", "Taktu þátt í áskorunum, hóptímum og viðburðum með öðrum í prógramminu."), icon: UsersRound },
  { title: t("acct.p.fraedsla", "Fræðsla"), desc: t("acct.p.stutt-gagnreynd-namskeid-um-allt", "Stutt, gagnreynd námskeið um allt frá svefni til próteinmarkmiða."), icon: BookOpen },
  { title: t("acct.p.einfold-naeringarskraning", "Einföld næringarskráning"), desc: t("acct.p.oflugt-undir-huddinu-og-einfalt", "Öflugt undir húddinu — og einfalt í notkun. Skráðu máltíð á nokkrum sekúndum; prótein, kolvetni og fita reiknast sjálfkrafa út frá máltíðaráætluninni þinni."), icon: Utensils },
  { title: t("acc.feat.weighins", "Vigtun og þróun"), desc: t("acct.p.vikulegar-aminningar-um-vigtun-sag", "Vikulegar áminningar um vigtun, saga líkamssamsetningar og þróunarlínur sem skipta máli."), icon: TrendingUp },
  { title: t("acc.feat.wearables", "Gögn úr snjallúrum"), desc: t("acc.feat.wearables-desc", "Tengdu Apple Watch, Garmin, Fitbit og fleiri. Skref, hjartsláttur, svefn og endurheimt skila sér inn í áætlunina."), icon: Watch },
  { title: t("acc.feat.scores", "Heilsueinkunnir"), desc: t("acc.feat.scores-desc", "Ein einkunn fyrir hverja stoð, frá 0 upp í 100. Hún hækkar eftir því sem venjurnar festast, svo að þú sjáir alltaf hvar þú stendur."), icon: Gauge },
];

export default function AppFeatures() {
  const { t } = useI18n();
  return (
    <SectionCard title={t("acct.p.hvad-er-i-appinu", "Hvað er í appinu")}
      description={t("acct.p.appid-breytir-skyrslunni-thinni-i", "Appið breytir skýrslunni þinni í daglegar aðgerðir í svefni, hreyfingu, næringu og andlegri líðan — með þjálfara, samfélagi og fræðslu innbyggðri.")}>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES(t).map((f) => {
          const Icon = f.icon;
          return (
            <li key={f.title} className={`${accountInset} p-4`}>
              <span aria-hidden className="mb-2 flex h-9 w-9 items-center justify-center rounded-hc-element bg-hc-brand-surface text-hc-brand-text"><Icon className="h-5 w-5" /></span>
              <p className="font-semibold text-hc-ink">{f.title}</p>
              <p className="mt-1 text-sm leading-snug text-hc-ink-2">{f.desc}</p>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-7 text-base font-bold text-hc-ink">{t("acct.p.framfarir-a-ollum-fjorum-stodum", "Framfarir á öllum fjórum stoðum")}</h3>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-hc-ink-2">
        {t("acct.p.styrkur-thol-lidleiki-og-nuvitund", "Styrkur, þol, liðleiki og núvitund — prógrömm byggð á þínu getustigi og áætlun læknisins þíns. Gerð fyrir raunverulegt líf: hver æfing er til bæði heima og í sal, svo þú getir æft hvar sem þú ert.")}
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {PILLARS(t).map((p) => {
          const Icon = p.icon;
          return (
            <li key={p.title} className={`rounded-hc-element p-3 ${p.tone}`}>
              <Icon className="mb-2 h-5 w-5" aria-hidden />
              <p className="font-semibold">{p.title}</p>
              <p className="mt-1 text-xs leading-snug text-hc-ink-2">{p.desc}</p>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
