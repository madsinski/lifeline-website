// The admin's UI kit, in one import:
//
//   import { AdminPage, AdminTable, Button, Modal, useDialog, useToast } from "@/app/admin/components/ui";
//
// Nothing new is invented here: the primitives are the account/ui and hc
// ones the participant app already uses (measured for contrast, Escape /
// focus-trap handled, Icelandic by default), re-exported so admin pages can
// migrate off hand-rolled overlays and native confirm()/alert() one at a
// time. DialogProvider and ToastProvider are mounted once in
// src/app/admin/layout.tsx, so useDialog() and useToast() work on every
// admin page.

export {
  Button, ButtonLink, buttonClass, type ButtonVariant, type ButtonSize,
  SectionCard, Alert, Field, Switch, accountCard, accountInset, accountInput, accountLabel, type AlertTone,
  Modal, ConfirmDialog, useDialog, type ConfirmOptions,
  fmtDate, fmtTime, fmtDateTime, fmtNumericDate, fmtMonthYear, fmtIsk,
  useFlash, SavedNote, friendlyError,
} from "@/app/components/account/ui";

export { hcTabs, hcBtn, hcCard, hcInput, hcPill, hcKicker } from "@/app/components/hc/ui";
export { default as Badge, badgeClass, type BadgeTone } from "@/app/components/hc/Badge";
export { useToast, useSaveStatus, SAVE_FAILED, type ToastApi, type ToastOptions } from "@/app/components/hc/Toast";
export { default as Sheet } from "@/app/components/hc/Sheet";

export { default as AdminTabs } from "../AdminTabs";
export { default as DeleteConfirmModal, verifyAdminPassword } from "../DeleteConfirmModal";
export { AdminPage } from "./AdminPage";
export { fmtNum } from "./format";
export { useDialogA11y } from "./useDialogA11y";
export { AdminTable, type AdminColumn } from "./AdminTable";
