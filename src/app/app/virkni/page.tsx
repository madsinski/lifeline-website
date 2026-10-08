import Soon from "../Soon";

export default function Page() {
  return (
    <Soon title="Virkni"
      body="Hreyfing, skref og það sem þú hefur merkt við — saman í einni mynd yfir vikuna og mánuðinn."
      now={{ label: "Sjá daginn", href: "/account/heilsuferd/aaetlun?tab=today" }} />
  );
}
