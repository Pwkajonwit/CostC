import type { Metadata } from "next";
import type { Viewport } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { PreventZoom } from "@/components/shared/PreventZoom";
import { APP_NAME, TABLES } from "@/lib/config";
import { getRows } from "@/lib/db";
import { cookies } from "next/headers";
import { ToastProvider } from "@/components/shared/ToastProvider";
import { LineAuthProvider } from "@/components/auth/LineAuthProvider";
import { TopProgressBar } from "@/components/shared/TopProgressBar";
import { UserPermissionSync } from "@/components/auth/UserPermissionSync";
import { extractMemberPermissions, findMemberInPeopleRows } from "@/lib/user-permissions";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  applicationName: APP_NAME,
  description: "Costcode web app",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    shortcut: "/icon-192.png",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ]
  }
};

export const viewport: Viewport = {
  themeColor: "#14883d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const employeeId = cookieStore.get("auth_employee_id")?.value;
  const name = cookieStore.get("auth_name")?.value;
  const role = cookieStore.get("auth_role")?.value;
  const pictureUrl = cookieStore.get("auth_picture_url")?.value;

  const currentUser: {
    id: string;
    name: string;
    role: string;
    pictureUrl: string;
    isOwner?: boolean;
    canApprove?: boolean;
    canCloseBill?: boolean;
    canDelete?: boolean;
  } | null = employeeId
    ? { id: employeeId, name: name || "", role: role || "User", pictureUrl: pictureUrl || "" }
    : null;

  let peopleRows: any[] = [];
  if (currentUser) {
    try {
      peopleRows = await getRows(TABLES.PEOPLE);
      if (peopleRows.length > 0) {
        const matched = findMemberInPeopleRows(peopleRows, currentUser.id);
        if (matched) {
          const perms = extractMemberPermissions(matched);
          currentUser.role = perms.role;
          currentUser.isOwner = perms.isOwner;
          currentUser.canApprove = perms.canApprove;
          currentUser.canCloseBill = perms.canCloseBill;
          currentUser.canDelete = perms.canDelete;
          if (perms.displayName) currentUser.name = perms.displayName;
          if (perms.pictureUrl) currentUser.pictureUrl = perms.pictureUrl;
        }
      }
    } catch (e) {
      // Ignore error if people table can't be fetched
    }
  }

  return (
    <html lang="th" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PreventZoom />
        <TopProgressBar />
        <LineAuthProvider isAuthenticated={Boolean(currentUser)}>
          <ToastProvider>
            {!currentUser ? (
              <LoginScreen />
            ) : (
              <AppShell peopleRows={peopleRows} currentUser={currentUser}>
                <UserPermissionSync currentRole={currentUser.role} employeeId={currentUser.id} />
                {children}
              </AppShell>
            )}
          </ToastProvider>
        </LineAuthProvider>
      </body>
    </html>
  );
}
