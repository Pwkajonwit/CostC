"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { YearFilterProvider } from "@/lib/context/YearFilterContext";
import { UserPermissionSync } from "@/components/auth/UserPermissionSync";

interface AppLayoutWrapperProps {
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
  children: React.ReactNode;
}

export function AppLayoutWrapper({
  currentUser,
  peopleRows,
  selectedYear,
  dataYears,
  children
}: AppLayoutWrapperProps) {
  const pathname = usePathname();

  // If visiting /form/* or /quick-*, render standalone without AppShell or LoginScreen
  const isStandalone = pathname?.startsWith("/form") || pathname?.startsWith("/quick-");

  if (isStandalone) {
    return <>{children}</>;
  }

  // Regular web app: check authentication
  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <YearFilterProvider initialYear={selectedYear} dataYears={dataYears}>
      <AppShell peopleRows={peopleRows} currentUser={currentUser}>
        <UserPermissionSync currentRole={currentUser.role} employeeId={currentUser.id} />
        {children}
      </AppShell>
    </YearFilterProvider>
  );
}
