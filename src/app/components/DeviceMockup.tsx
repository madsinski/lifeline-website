import StaticPhone from "./StaticPhone";
import StaticLaptop from "./StaticLaptop";

// One mockup slot that renders either a phone or a laptop frame, chosen per
// slot in the website CMS (a "select" field: phone | laptop). The screenshot is
// also CMS-editable, so a laptop slot can point at a landscape screenshot.
export default function DeviceMockup({
  device,
  screenshot,
  alt,
  phoneHeight = "70vh",
  laptopMaxWidth = "560px",
}: {
  device?: string;
  screenshot: string;
  alt?: string;
  phoneHeight?: string;
  laptopMaxWidth?: string;
}) {
  if (device === "laptop") {
    return <StaticLaptop screenshot={screenshot} alt={alt} maxWidth={laptopMaxWidth} />;
  }
  return <StaticPhone screenshot={screenshot} alt={alt} phoneHeight={phoneHeight} />;
}
