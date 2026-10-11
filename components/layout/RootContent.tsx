"use client";

import { usePathname } from "next/navigation";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { AppShell } from "@/components/layout/AppShell";
import { UserPermissionSync } from "@/components/auth/UserPermissionSync";
import { YearFilterProvider } from "@/lib/context/YearFilterContext";
import type { ReactNode } from "react";

type RootContentProps = {
  currentUser: {
    id: string;
    name: string;
    role: string;
    pictureUrl: string;
    isOwner?: boolean;
    canApprove?: boolean;
    canCloseBill?: boolean;
    canDelete?: boolean;
  } | null;
  peopleRows: any[];
  selectedYear: string;
  dataYears: number[];
  children: ReactNode;
};

// Routes that should be rendered standalone without AppShell (sidebars/navbars) or login screen
const STANDALONE_ROUTES = ["/quick-work", "/quick-task", "/task-upload"];

export function RootContent({
  currentUser,
  peopleRows,
  selectedYear,
  dataYears,
  children,
}: RootContentProps) {
  const pathname = usePathname();

  // If visiting standalone public route (e.g. /quick-work), render ONLY the form page directly
  const isStandalone = STANDALONE_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(`${route}/`)
  );

  if (isStandalone) {
    return <>{children}</>;
  }

  // Normal app flow: require login
  if (!currentUser) {
    return <LoginScreen />;
  }

  // Normal authenticated app layout with AppShell and sidebars
  return (
    <YearFilterProvider initialYear={selectedYear} dataYears={dataYears}>
      <AppShell peopleRows={peopleRows} currentUser={currentUser}>
        <UserPermissionSync currentRole={currentUser.role} employeeId={currentUser.id} />
        {children}
      </AppShell>
    </YearFilterProvider>
  );
}
