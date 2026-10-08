import Soon from "../Soon";

export default function Page() {
  return (
    <Soon title="Stofan"
      body="Tímabókanir, mælingar, blóðprufur og upplýsingar um stofuna — það sem ClinicInfoScreen gerir í appinu."
      now={{ label: "Bóka tíma", href: "/account/book" }} />
  );
}
