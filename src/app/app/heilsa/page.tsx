import Soon from "../Soon";

export default function Page() {
  return (
    <Soon title="Heilsan"
      body="Hér verða mælingarnar þínar, skýrslan og þróunin yfir tíma á einum stað. Þær eru þegar til í heilsuferðinni á meðan."
      now={{ label: "Opna heilsuferðina", href: "/account/heilsuferd/aaetlun?tab=results" }} />
  );
}
