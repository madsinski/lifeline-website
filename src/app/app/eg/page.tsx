import Soon from "../Soon";

export default function Page() {
  return (
    <Soon title="Ég"
      body="Aðgangurinn þinn, áminningar, áskrift og persónuverndin. Allt er til í aðgangssíðunni á meðan."
      now={{ label: "Opna aðganginn", href: "/account/heilsuferd/adgangur" }} />
  );
}
