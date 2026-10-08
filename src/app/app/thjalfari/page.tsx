import Soon from "../Soon";

export default function Page() {
  return (
    <Soon title="Þjálfari"
      body="Prógrammið þitt, æfing dagsins og samtalið við þjálfarann — það sem HealthCoachScreen gerir í appinu."
      now={{ label: "Hafa samband", href: "/account/heilsuferd/aaetlun?tab=coach" }} />
  );
}
