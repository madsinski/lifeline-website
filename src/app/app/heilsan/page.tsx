import Soon from "../Soon";

export default function Page() {
  return (
    <Soon title="Heilsan"
      body="Mælingarnar þínar yfir tíma: líkamssamsetning, blóðgildi, blóðþrýstingur og þyngd — það sem MyHealthScreen gerir í appinu."
      now={{ label: "Sjá niðurstöðurnar", href: "/account/heilsuferd/aaetlun?tab=results" }} />
  );
}
