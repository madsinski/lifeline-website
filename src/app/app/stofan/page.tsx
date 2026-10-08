"use client";

import Soon from "../Soon";
import { useT } from "../useT";

export default function Page() {
  const t = useT();
  return (
    <Soon title={t("nav.clinic")} body={t("clinic.body")}
      now={{ label: t("clinic.now"), href: "/account/book" }}
    />
  );
}
