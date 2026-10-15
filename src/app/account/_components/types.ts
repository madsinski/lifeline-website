// Shapes shared by the account page's hooks, sections and components.

export type SectionId = "yfirlit" | "heilsumat" | "appid" | "adgangur";
export type BodyCompStatus = "none" | "booked" | "completed";
export type PackageKey = "foundational" | "checkin" | "self-checkin";
export type JourneyCheckKey = "questionnaire" | "blood_test" | "results_viewed";
export type JourneyChecks = Partial<Record<JourneyCheckKey, string>>;
export type SatisfactionContext = "body_comp" | "doctor" | "overall";

export interface Profile {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  /** ISO YYYY-MM-DD or "". */
  dob: string;
  sex: string;
}

export interface CompanyEvent {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  room_notes: string | null;
  break_start: string | null;
  break_end: string | null;
  slot_minutes: number;
  slot_capacity: number;
  company_id: string;
}

export type DoctorMode = "video" | "phone" | "in_person";

export interface DoctorSlot {
  id: string;
  slot_at: string;
  duration_minutes: number;
  mode: DoctorMode;
  location: string | null;
  meeting_link: string | null;
  doctor_name: string | null;
  notes: string | null;
}

export interface MyDoctorSlot extends DoctorSlot {
  booking_note: string | null;
}

export interface DayRow { day: string; notes: string | null }
export interface BloodTestBooking { day: string; note: string | null }

export interface CurrentBooking {
  id: string | null;
  paid: boolean;
  amount: number;
  scheduledAt: string | null;
}

export interface ResolvedRefund {
  id: string;
  status: "approved" | "denied";
  admin_note: string | null;
  approved_isk: number | null;
  resolved_at: string;
}

export interface PendingBooking { id: string; package: string | null; scheduled_at: string | null }

export interface SubscriptionRow {
  id: string;
  tier: string;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
}

export interface AccountState {
  profile: Profile;
  avatarUrl: string | null;
  companyId: string | null;
  companyName: string | null;
  bodyCompStatus: BodyCompStatus;
  bodyCompPackage: PackageKey | null;
  bodyCompBookingAt: string | null;
  booking: CurrentBooking;
  pendingRefundRequestId: string | null;
  resolvedRefund: ResolvedRefund | null;
  pendingBooking: PendingBooking | null;
  journeyChecks: JourneyChecks;
  checkinDoctorAddonPaidAt: string | null;
  biodyActivated: boolean;
  companyEvent: CompanyEvent | null;
  mySlotAt: string | null;
  upcomingBloodDays: DayRow[];
  upcomingMeasurementDays: DayRow[];
  myBloodTestBooking: BloodTestBooking | null;
  myDoctorSlot: MyDoctorSlot | null;
  upcomingDoctorSlots: DoctorSlot[];
  videoPortalConfirmedAt: string | null;
  lastWellbeingAt: string | null;
  satisfactionDone: Record<SatisfactionContext, boolean>;
  subscription: SubscriptionRow | null;
}

export type Patch = Partial<AccountState> | ((prev: AccountState) => Partial<AccountState>);
