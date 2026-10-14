// Moved to /app/adgangur — see ../page.tsx for why the old path stays.
import { permanentRedirect } from "next/navigation";

export default function Moved() {
  permanentRedirect("/app/adgangur");
}
