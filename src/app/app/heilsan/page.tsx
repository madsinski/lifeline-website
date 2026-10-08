"use client";

import Soon from "../Soon";
import { useT } from "../useT";

export default function Page() {
  const t = useT();
  return (
    <Soon title={t("nav.health")} body={t("health.body")}
      now={{ label: t("health.now"), href: "/account/heilsuferd/aaetlun?tab=results" }}
    />
  );
}
