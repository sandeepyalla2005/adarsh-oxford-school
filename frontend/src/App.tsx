import React, { Component, lazy, Suspense, useEffect } from "react";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { getPortalDashboardPath, getPortalFromRole, portalPath, getPortalBasePath, getPortalFromPath, getPortalAuthPath, type PortalType, getAppBuildMode } from "@/lib/portal";
import PortalAuth from "./components/auth/PortalAuth";

// Helper to handle ChunkLoadError by forcing a reload
const lazyWithRetry = (componentImport: () => Promise<any>) => 
  lazy(async () => {
    const pageHasBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasBeenForceRefreshed) {
        // Log the error and force refresh
        console.error('Lazy loading failed, forcing refresh...', error);
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        window.location.reload();
        // Return a never-resolving promise since the page is reloading
        return new Promise<never>(() => {});
      }
      // If we already refreshed and it still fails, throw the error
      throw error;
    }
  });

const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Students = lazyWithRetry(() => import("./pages/Students"));
const LeftStudents = lazyWithRetry(() => import("./pages/LeftStudents"));
const ClassStudents = lazyWithRetry(() => import("./pages/ClassStudents"));
const CourseFees = lazyWithRetry(() => import("./pages/CourseFees"));
const BooksFees = lazyWithRetry(() => import("./pages/BooksFees"));
const TransportFees = lazyWithRetry(() => import("./pages/TransportFees"));
const FeeHistory = lazyWithRetry(() => import("./pages/FeeHistory"));
const PendingFees = lazyWithRetry(() => import("./pages/PendingFees"));
const AccessoriesHistory = lazyWithRetry(() => import("./pages/AccessoriesHistory"));
const AccessoriesUniform = lazyWithRetry(() => import("./pages/AccessoriesUniform"));
const UniformIssue = lazyWithRetry(() => import("./pages/UniformIssue"));
const AccessoryIssue = lazyWithRetry(() => import("./pages/AccessoryIssue"));
const AccessoryReceiptPage = lazyWithRetry(() => import("./pages/AccessoryReceiptPage"));
const UserManagement = lazyWithRetry(() => import("./pages/UserManagement"));
const FeeStructure = lazyWithRetry(() => import("./pages/FeeStructure"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const TimeTable = lazyWithRetry(() => import("./pages/TimeTable"));
const AcademicCalendar = lazyWithRetry(() => import("./pages/AcademicCalendar"));
const StaffManagement = lazyWithRetry(() => import("./pages/StaffManagement"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const Sms = lazyWithRetry(() => import("./pages/Sms"));
const StaffProfile = lazyWithRetry(() => import("./pages/staff/StaffProfile"));
const Attendance = lazyWithRetry(() => import("./pages/staff/Attendance"));
const Homework = lazyWithRetry(() => import("./pages/staff/Homework"));
const Notices = lazyWithRetry(() => import("./pages/staff/Notices"));
const AcademicReports = lazyWithRetry(() => import("./pages/staff/AcademicReports"));
const StaffSchedule = lazyWithRetry(() => import("./pages/staff/StaffSchedule"));
const Receipt = lazyWithRetry(() => import("./pages/Receipt"));
const DatabaseCheck = lazyWithRetry(() => import("./pages/DatabaseCheck"));
const AdminAttendance = lazyWithRetry(() => import("./pages/admin/AdminAttendance"));
const AdminHomework = lazyWithRetry(() => import("./pages/admin/AdminHomework"));
const AdminApprovals = lazyWithRetry(() => import("./pages/admin/AdminApprovals"));
const AdminAudit = lazyWithRetry(() => import("./pages/AdminAudit"));
const FeeAnalytics = lazyWithRetry(() => import("./pages/FeeAnalytics"));
const FinancialReports = lazyWithRetry(() => import("./pages/FinancialReports"));
const AccessoriesFees = lazyWithRetry(() => import("./pages/AccessoriesFees"));
const PaymentGateway = lazyWithRetry(() => import("./pages/PaymentGateway"));
const TableRegistryCheck = lazyWithRetry(() => import("./pages/TableRegistryCheck"));

const PublicFeePayment = lazyWithRetry(() => import("./pages/PublicFeePayment"));
const FeeVerifications = lazyWithRetry(() => import("./pages/admin/FeeVerifications"));

import { queryClient } from "@/lib/query-client";

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || "Unexpected application error" };
  }

  componentDidCatch(error: Error) {
    console.error("Application crashed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-lg">
            <h1 className="text-xl font-bold text-red-700">Application error</h1>
            <p className="mt-2 text-sm text-slate-600">
              {this.state.message || "The portal failed to render. Check the browser console for details."}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const RouteLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

type AppMode = "combined" | PortalType;

const ADMIN_AUTH_ROLES = ["admin"] as const;
const STAFF_AUTH_ROLES = ["staff"] as const;
const FEE_AUTH_ROLES = ["feeInCharge"] as const;

type PortalRouteDef = {
  path: string;
  element: React.ReactElement;
  portals: PortalType[];
};

const portalRoutes: PortalRouteDef[] = [
  { path: "/dashboard", element: <Dashboard />, portals: ["admin", "staff", "fee"] },
  { path: "/students", element: <Students />, portals: ["admin", "staff", "fee"] },
  { path: "/left-students", element: <LeftStudents />, portals: ["admin", "fee"] },
  { path: "/students/:className", element: <ClassStudents />, portals: ["admin", "staff", "fee"] },
  { path: "/course-fees", element: <CourseFees />, portals: ["admin", "fee"] },
  { path: "/books-fees", element: <BooksFees />, portals: ["admin", "fee"] },
  { path: "/transport-fees", element: <TransportFees />, portals: ["admin", "fee"] },
  { path: "/fee-history", element: <FeeHistory />, portals: ["admin", "fee"] },
  { path: "/pending-fees", element: <PendingFees />, portals: ["admin", "fee"] },
  { path: "/accessories", element: <AccessoriesFees />, portals: ["admin", "fee"] },
  { path: "/payment-gateway", element: <PaymentGateway />, portals: ["admin", "fee"] },
  { path: "/accessories/history", element: <AccessoriesHistory />, portals: ["admin", "fee"] },
  { path: "/accessories/uniform", element: <UniformIssue />, portals: ["admin", "fee"] },
  { path: "/accessories/uniform/inventory", element: <AccessoriesUniform />, portals: ["admin", "fee"] },
  { path: "/accessories/receipt/:id", element: <AccessoryReceiptPage />, portals: ["admin", "fee"] },
  { path: "/accessories/:type", element: <AccessoryIssue />, portals: ["admin", "fee"] },
  { path: "/notices", element: <Notices />, portals: ["admin", "staff", "fee"] },
  { path: "/sms", element: <Sms />, portals: ["admin", "fee"] },
  { path: "/profile", element: <StaffProfile />, portals: ["staff"] },
  { path: "/attendance", element: <Attendance />, portals: ["staff"] },
  { path: "/attendance", element: <AdminAttendance />, portals: ["admin", "fee"] },
  { path: "/homework", element: <Homework />, portals: ["staff"] },
  { path: "/homework", element: <AdminHomework />, portals: ["admin", "fee"] },
  { path: "/reports", element: <AcademicReports />, portals: ["staff"] },
  { path: "/schedule", element: <StaffSchedule />, portals: ["staff"] },
  { path: "/users", element: <UserManagement />, portals: ["admin"] },
  { path: "/fee-structure", element: <FeeStructure />, portals: ["admin", "fee"] },
  { path: "/time-table", element: <TimeTable />, portals: ["admin", "fee"] },
  { path: "/academic-calendar", element: <AcademicCalendar />, portals: ["admin", "staff", "fee"] },
  { path: "/audit", element: <AdminAudit />, portals: ["admin"] },
  { path: "/fee-analytics", element: <FeeAnalytics />, portals: ["admin"] },
  { path: "/financial-reports", element: <FinancialReports />, portals: ["admin", "staff", "fee"] },
  { path: "/approvals", element: <AdminApprovals />, portals: ["admin"] },
  { path: "/staff-login", element: <StaffManagement />, portals: ["admin"] },
  { path: "/settings", element: <Settings />, portals: ["admin"] },
  { path: "/receipt", element: <Receipt />, portals: ["admin", "staff", "fee"] },
  { path: "/db-check", element: <DatabaseCheck />, portals: ["admin"] },
  { path: "/schema-check", element: <TableRegistryCheck />, portals: ["admin"] },
  { path: "/verifications", element: <FeeVerifications />, portals: ["admin", "fee"] },
];

function ProtectedRoute({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode: AppMode;
}) {
  const { user, userRole, isLoading } = useAuth();
  const { pathname } = useLocation();

  if (isLoading) {
    return <RouteLoader />;
  }

  if (!user) {
    const intendedPortal = mode === "combined" ? getPortalFromPath(pathname) : mode;
    return <Navigate to={getPortalAuthPath(intendedPortal)} replace />;
  }

  // Role-based portal enforcement
  if (mode === "combined") {
    const activePortal = getPortalFromRole(userRole);
    const pathPortal = getPortalFromPath(pathname);
    
    // If user is on a portal path that doesn't match their role
    // e.g. Admin on a /staff/ path
    if (activePortal !== pathPortal && userRole !== 'admin') {
      return <Navigate to={getPortalDashboardPath(userRole)} replace />;
    }
    
    // Special case: Admin can be anywhere, but if they are on a /staff or /fee path, 
    // we might want to keep them there IF they intended to go there. 
    // However, the user explicitly asked to reroute admin to /admin.
    if (userRole === 'admin' && pathPortal !== 'admin' && pathname.includes('/dashboard')) {
       return <Navigate to={portalPath('admin', pathname.replace(/^\/(staff|fee)/, ''))} replace />;
    }
  } else {
    const activePortal = getPortalFromRole(userRole);
    const isAdmin = userRole === "admin";
    if (activePortal !== mode && !isAdmin) {
      return <Navigate to={getPortalAuthPath(mode)} replace />;
    }
  }

  return <>{children}</>;
}

const PortalRedirect = ({ path }: { path: string }) => {
  const { userRole, isLoading } = useAuth();
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    // If auth is still loading after 5s, stop spinning and redirect to root
    if (isLoading) {
      const t = setTimeout(() => setTimedOut(true), 5000);
      return () => clearTimeout(t);
    }
  }, [isLoading]);

  // Wait for auth to finish before redirecting to prevent race conditions
  if ((isLoading || !userRole) && !timedOut) return <RouteLoader />;
  if (!userRole) return <Navigate to="/" replace />;
  return <Navigate to={`/${getPortalFromRole(userRole)}${path.startsWith('/') ? path : '/' + path}`} replace />;
};

const AppRoutes = ({ mode }: { mode: AppMode }) => {
  const { user, userRole, isLoading } = useAuth();

  // Debug removed - routing is stable

  if (isLoading) {
    return <RouteLoader />;
  }

  const dashboardPath = mode === 'combined' 
    ? getPortalDashboardPath(userRole) 
    : `/${mode}/dashboard`;
  const activePortal = getPortalFromRole(userRole);
  const allowedPortals = mode === "combined" ? (["admin", "staff", "fee"] as PortalType[]) : ([mode] as PortalType[]);
  const portalMatchesBuild = 
    mode === "combined" || 
    activePortal === mode || 
    userRole === "admin";
    
  const authRoles =
    mode === "combined"
      ? undefined
      : mode === "admin"
        ? ADMIN_AUTH_ROLES
        : mode === "fee"
          ? FEE_AUTH_ROLES
          : STAFF_AUTH_ROLES;

  // Filter routes based on allowed portals for this build
  const filteredRoutes = portalRoutes.filter((route) => 
    route.portals.some((p) => allowedPortals.includes(p))
  );

  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes key={mode}>
        {/* Primary Auth Route */}
        <Route
          path="/"
          element={
            user && portalMatchesBuild ? (
              <Navigate to={dashboardPath} replace />
            ) : (
              <PortalAuth 
                portalType={mode === 'combined' ? getPortalFromPath(window.location.pathname) : (mode as 'admin' | 'staff' | 'fee')} 
                allowedRoles={
                  mode === 'combined' 
                    ? (getPortalFromPath(window.location.pathname) === 'admin' ? ADMIN_AUTH_ROLES : getPortalFromPath(window.location.pathname) === 'staff' ? STAFF_AUTH_ROLES : FEE_AUTH_ROLES)
                    : (authRoles || ADMIN_AUTH_ROLES)
                } 
              />
            )
          }
        />
        
        {/* Legacy/Convenience Redirects */}
        <Route path="/auth" element={<Navigate to="/" replace />} />
        <Route path="/admin" element={<Navigate to="/" replace />} />
        <Route path="/staff" element={<Navigate to="/" replace />} />
        <Route path="/fee" element={<Navigate to="/" replace />} />
        {/* Portal-Specific Auth Routes */}
        <Route path="/admin/auth" element={<PortalAuth portalType="admin" allowedRoles={ADMIN_AUTH_ROLES} />} />
        <Route path="/staff/auth" element={<PortalAuth portalType="staff" allowedRoles={STAFF_AUTH_ROLES} />} />
        <Route path="/fee/auth" element={<PortalAuth portalType="fee" allowedRoles={FEE_AUTH_ROLES} />} />

        {/* Shared Root Redirects for Combined Mode */}
        {mode === "combined" && (
          <>
            <Route path="/dashboard" element={<PortalRedirect path="/dashboard" />} />
            <Route path="/students" element={<PortalRedirect path="/students" />} />
            <Route path="/notices" element={<PortalRedirect path="/notices" />} />
            <Route path="/settings" element={<PortalRedirect path="/settings" />} />
            <Route path="/profile" element={<PortalRedirect path="/profile" />} />
          </>
        )}

        {mode === "admin" && <Route path="/admin.html" element={<Navigate to="/" replace />} />}
        {mode === "staff" && <Route path="/staff.html" element={<Navigate to="/" replace />} />}
        {mode === "fee" && <Route path="/fee.html" element={<Navigate to="/" replace />} />}
        
        {/* Public Fee Payment Gate */}
        <Route path="/pay" element={<PublicFeePayment />} />

        {/* Dynamic Portal Routes - Generate ALL routes for ALL portals to prevent 404s */}
        {portalRoutes.flatMap((route) => {
          const routes = [];
          
          // Generate routes for each portal this page belongs to
          route.portals.forEach(p => {
            const prefix = getPortalBasePath(p);
            
            // 1. Prefixed path (e.g. /admin/dashboard, /staff/dashboard)
            routes.push(
              <Route
                key={`${p}${route.path}`}
                path={`${prefix}${route.path.startsWith("/") ? route.path : `/${route.path}`}`}
                element={<ProtectedRoute mode={mode}>{route.element}</ProtectedRoute>}
              />
            );

            // 2. Short path (e.g. /dashboard) - only for the current build mode's portal
            // Or if in combined mode, we'll handle this via redirects (already handled above)
            const activePortal = getPortalFromRole(userRole);
            if (p === mode || (mode === "combined" && p === activePortal)) {
              routes.push(
                <Route
                  key={`short-${p}-${route.path}`}
                  path={route.path}
                  element={<ProtectedRoute mode={mode}>{route.element}</ProtectedRoute>}
                />
              );
            }
          });
          
          return routes;
        })}

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

type AppShellProps = {
  mode?: AppMode;
};

export function AppShell({ mode = "combined" }: AppShellProps) {
  // In local development / localhost, dynamically detect the mode from port or path to support refreshing pages
  // because the browser fallback requests index.html (which runs admin-main.js).
  let resolvedMode = mode;
  if (typeof window !== "undefined" && 
      (window.location.hostname === "localhost" || 
       window.location.hostname === "127.0.0.1" || 
       window.location.hostname === "0.0.0.0")) {
    resolvedMode = getAppBuildMode();
  }

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <AppRoutes mode={resolvedMode} />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

const App = ({ portal }: { portal?: AppMode }) => <AppShell mode={portal} />;

export default App;
