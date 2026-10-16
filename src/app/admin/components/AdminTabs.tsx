"use client";

// The admin tab bar (every wrapper page: business, content, scheduling, …).
//
// - Real tabs: role=tablist/tab, aria-selected, roving tabindex, and the
//   arrow keys / Home / End move between them, as a screen-reader user
//   expects from something announced as a tab list.
// - Scrolls sideways on a phone instead of squashing; the track is a
//   visible white bar with a hairline, not grey on the grey page.
// - Active tab is hc-brand-dark (white on #047857 = 5.5:1), like hcTabs.
// - Deep links: the active tab mirrors ?tab= in the URL (router.replace, so
//   no history spam), and a ?tab= present on arrival selects that tab. Pages
//   that already read ?tab= once on mount keep working — this just agrees
//   with them. Pass `urlParam={false}` for a bar that is a filter, not a
//   page section.

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

interface Tab {
  key: string;
  label: string;
  icon?: ReactNode;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  /** Accessible name of the tab list. */
  label?: string;
  /** Query parameter to mirror the active tab in; false = don't. */
  urlParam?: string | false;
}

export default function AdminTabs({ tabs, active, onChange, label = "Flipar", urlParam = "tab" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  // On arrival: a valid ?tab= wins over the page's default.
  const tabsKey = tabs.map((t) => t.key).join("|");
  useEffect(() => {
    if (!urlParam || typeof window === "undefined") return;
    const want = new URLSearchParams(window.location.search).get(urlParam);
    if (want && want !== active && tabsKey.split("|").includes(want)) onChangeRef.current(want);
    // Only on mount / when the set of tabs changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParam, tabsKey]);

  const select = (key: string) => {
    onChange(key);
    if (!urlParam || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get(urlParam) === key) return;
    params.set(urlParam, key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
    select(tabs[next].key);
  };

  return (
    <div className="mb-6 -mx-1 overflow-x-auto px-1 pb-1">
      <div
        role="tablist"
        aria-label={label}
        className="inline-flex min-w-full items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200 sm:min-w-0"
      >
        {tabs.map((tab, i) => {
          const on = active === tab.key;
          return (
            <button
              key={tab.key}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="tab"
              id={`admintab-${tab.key}`}
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => select(tab.key)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand focus-visible:ring-offset-1 ${
                on
                  ? "bg-hc-brand-dark text-white shadow-sm"
                  : "text-slate-600 hover:bg-hc-brand-surface hover:text-hc-brand-text"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
