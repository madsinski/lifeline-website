// What every tab of /account receives from the page.

import type { User } from "@supabase/supabase-js";
import type { BookingActions } from "./useBooking";
import type { Journey } from "./journey";
import type { AccountState, Patch, SatisfactionContext, SectionId } from "./types";

export interface ModalOpeners {
  bodyCompSlot: () => void;
  bloodTestDay: () => void;
  doctorSlot: () => void;
  biody: () => void;
  refundRequest: () => void;
  wellbeing: () => void;
  satisfaction: (ctx: SatisfactionContext) => void;
}

export interface SectionProps {
  user: User;
  state: AccountState;
  patch: (p: Patch) => void;
  actions: BookingActions;
  open: ModalOpeners;
  journey: Journey;
  hrefFor: (s: SectionId) => string;
}
