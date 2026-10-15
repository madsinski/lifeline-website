"use client";

// Providers for every participant page under /app: one toast for saves that
// succeed or fail, and the confirm dialog that replaces window.confirm().
// Mounted here once rather than per page, so a component that calls
// useToast() or useDialog() works wherever it is rendered in the app.

import { ToastProvider } from "@/app/components/hc/Toast";
import { DialogProvider } from "@/app/components/account/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <DialogProvider>{children}</DialogProvider>
    </ToastProvider>
  );
}
