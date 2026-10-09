"use client";

// One action, tickable. Shared by the Today list and the pillar weeks.

import { Check, Dumbbell, Moon, Sparkles, Utensils } from "lucide-react";
import { useT } from "./../useT";
import type { StringKey } from "./../strings";
import { appBrand, appCard } from "./../ui";

export interface Action {
  actionKey: string; label: string; pillar: string; details: string[];
  dayOfWeek: number; timeGroup: string | null; modality: string | null;
  durationMin: number | null; libKey: string | null; sortOrder: number;
  added: boolean; done: boolean;
}

export const PILLAR = {
  exercise: { colour: appBrand.exercise, Icon: Dumbbell, key: "pillar.exercise" as StringKey },
  nutrition: { colour: appBrand.nutrition, Icon: Utensils, key: "pillar.nutrition" as StringKey },
  sleep: { colour: appBrand.sleep, Icon: Moon, key: "pillar.sleep" as StringKey },
  mental: { colour: appBrand.mental, Icon: Sparkles, key: "pillar.mental" as StringKey },
} as const;
export const pillarOf = (p: string) => PILLAR[p as keyof typeof PILLAR] ?? PILLAR.exercise;

export default function ActionRow({ a, onToggle, busy, tickable = true, showPillar = true }: {
  a: Action;
  onToggle?: (a: Action) => void;
  busy?: boolean;
  /** Future days show the plan; only today can be ticked. */
  tickable?: boolean;
  showPillar?: boolean;
}) {
  const t = useT();
  const p = pillarOf(a.pillar);
  const Tag = tickable && onToggle ? "button" : "div";

  return (
    <Tag
      {...(tickable && onToggle
        ? { type: "button" as const, onClick: () => onToggle(a), disabled: busy, "aria-pressed": a.done }
        : {})}
      className={`${appCard} flex w-full items-start gap-3 p-3.5 text-left transition disabled:opacity-60 ${
        tickable && onToggle ? "active:scale-[0.995]" : ""}`}>
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition"
        style={{
          borderColor: a.done ? appBrand.primary : tickable ? appBrand.ink4 : "transparent",
          background: a.done ? appBrand.primary : tickable ? "transparent" : appBrand.cardAlt,
        }}>
        {a.done && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          {showPillar && (
            <>
              <p.Icon className="h-3.5 w-3.5 shrink-0" style={{ color: p.colour }} aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: p.colour }}>
                {t(p.key)}
              </span>
            </>
          )}
          {a.durationMin ? (
            <span className="text-[10px]" style={{ color: appBrand.ink3 }}>
              {showPillar ? "· " : ""}{a.durationMin} {t("coach.min")}
            </span>
          ) : null}
          {a.added && (
            <span className="rounded-full px-1.5 text-[9px] font-bold uppercase"
              style={{ background: `${appBrand.primary}1a`, color: appBrand.primaryDark }}>
              {t("coach.added")}
            </span>
          )}
        </span>
        <span className={`mt-0.5 block text-sm font-bold ${a.done ? "line-through" : ""}`}
          style={{ color: a.done ? appBrand.ink3 : appBrand.ink1 }}>
          {a.label}
        </span>
        {a.details.length > 0 && (
          <span className="mt-0.5 block text-xs leading-snug" style={{ color: appBrand.ink2 }}>
            {a.details.slice(0, 2).join(" · ")}
          </span>
        )}
      </span>
    </Tag>
  );
}
