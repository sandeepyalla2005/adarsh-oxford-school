import { Component, lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { getPortalDashboardPath, getPortalFromRole, portalPath, type PortalType } from "@/lib/portal";
import Auth from "./pages/Auth";

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
        return window.location.reload();
      }
      // If we already refreshed and it still fails, throw the error
      throw error;
    }
  });

const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Students = lazyWithRetry(() => import("./pages/Students"));
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
const AdminAudit = lazyWithRetry(() => import("./pages/AdminAudit"));
const FeeAnalytics = lazyWithRetry(() => import("./pages/FeeAnalytics"));
const AccessoriesFees = lazyWithRetry(() => import("./pages/AccessoriesFees"));
const TableRegistryCheck = lazyWithRetry(() => import("./pages/TableRegistryCheck"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

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
const STAFF_AUTH_ROLES = ["staff", "admin"] as const;
const FEE_AUTH_ROLES = ["feeInCharge", "admin"] as const;

type PortalRouteDef = {
  path: string;
  element: JSX.Element;
  portals: PortalType[];
};

const portalRoutes: PortalRouteDef[] = [
  { path: "/dashboard", element: <Dashboard />, portals: ["admin", "staff", "fee"] },
  { path: "/students", element: <Students />, portals: ["admin", "staff", "fee"] },
  { path: "/students/:className", element: <ClassStudents />, portals: ["admin", "staff", "fee"] },
  { path: "/course-fees", element: <CourseFees />, portals: ["admin", "fee"] },
  { path: "/books-fees", element: <BooksFees />, portals: ["admin", "fee"] },
  { path: "/transport-fees", element: <TransportFees />, portals: ["admin", "fee"] },
  { path: "/fee-history", element: <FeeHistory />, portals: ["admin", "fee"] },
  { path: "/pending-fees", element: <PendingFees />, portals: ["admin", "fee"] },
  { path: "/accessories", element: <AccessoriesFees />, portals: ["admin", "fee"] },
  { path: "/accessories/history", element: <AccessoriesHistory />, portals: ["admin", "fee"] },
  { path: "/accessories/uniform", element: <UniformIssue />, portals: ["admin", "fee"] },
  { path: "/accessories/uniform/inventory", element: <AccessoriesUniform />, portals: ["admin", "fee"] },
  { path: "/accessories/receipt/:id", element: <AccessoryReceiptPage />, portals: ["admin", "fee"] },
  { path: "/accessories/:type", element: <AccessoryIssue />, portals: ["admin", "fee"] },
  { path: "/notices", element: <Notices />, portals: ["admin", "staff", "fee"] },
  { path: "/sms", element: <Sms />, portals: ["admin", "fee"] },
  { path: "/profile", element: <StaffProfile />, portals: ["staff"] },
  { path: "/attendance", element: <Attendance />, portals: ["staff"] },
  { path: "/attendance", element: <AdminAttendance />, portals: ["admin"] },
  { path: "/homework", element: <Homework />, portals: ["staff"] },
  { path: "/homework", element: <AdminHomework />, portals: ["admin"] },
  { path: "/reports", element: <AcademicReports />, portals: ["staff"] },
  { path: "/schedule", element: <StaffSchedule />, portals: ["staff"] },
  { path: "/users", element: <UserManagement />, portals: ["admin"] },
  { path: "/fee-structure", element: <FeeStructure />, portals: ["admin", "fee"] },
  { path: "/time-table", element: <TimeTable />, portals: ["admin"] },
  { path: "/academic-calendar", element: <AcademicCalendar />, portals: ["admin", "staff", "fee"] },
  { path: "/audit", element: <AdminAudit />, portals: ["admin"] },
  { path: "/fee-analytics", element: <FeeAnalytics />, portals: ["admin"] },
  { path: "/staff-login", element: <StaffManagement />, portals: ["admin"] },
  { path: "/settings", element: <Settings />, portals: ["admin"] },
  { path: "/receipt", element: <Receipt />, portals: ["admin", "staff", "fee"] },
  { path: "/db-check", element: <DatabaseCheck />, portals: ["admin"] },
  { path: "/schema-check", element: <TableRegistryCheck />, portals: ["admin"] },
];

function ProtectedRoute({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode: AppMode;
}) {
  const { user, userRole, isLoading } = useAuth();

  if (isLoading) {
    return <RouteLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (mode !== "combined") {
    const activePortal = getPortalFromRole(userRole);
    const isAdmin = userRole === "admin";
    if (activePortal !== mode && !isAdmin) {
      return <Navigate to="/auth" replace />;
    }
  }

  return <>{children}</>;
}

const PortalRedirect = ({ path }: { path: string }) => {
  const { userRole } = useAuth();
  return <Navigate to={portalPath(getPortalFromRole(userRole), path)} replace />;
};

const AppRoutes = ({ mode }: { mode: AppMode }) => {
  const { user, userRole, isLoading } = useAuth();

  if (isLoading) {
    return <RouteLoader />;
  }

  const dashboardPath = getPortalDashboardPath(userRole);
  const activePortal = getPortalFromRole(userRole);
  const allowedPortals = mode === "combined" ? ["admin", "staff", "fee"] : [mode as PortalType];
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

  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
      {mode === "admin" && <Route path="/admin.html" element={<Navigate to="/" replace />} />}
      {mode === "staff" && <Route path="/staff.html" element={<Navigate to="/" replace />} />}
      {mode === "fee" && <Route path="/fee.html" element={<Navigate to="/" replace />} />}
      <Route
        path="/"
        element={user && portalMatchesBuild ? <Navigate to={dashboardPath} replace /> : <Navigate to="/auth" replace />}
      />
      <Route
        path="/auth"
        element={
          user && portalMatchesBuild ? (
            <Navigate to={dashboardPath} replace />
          ) : (
            <Auth allowedRoles={authRoles} />
          )
        }
      />
      {mode === "combined" && (
        <>
          <Route
            path="/admin/auth"
            element={user && portalMatchesBuild ? <Navigate to={portalPath("admin", "/dashboard")} replace /> : <Auth allowedRoles={ADMIN_AUTH_ROLES} />}
          />
          <Route
            path="/staff/auth"
            element={user && portalMatchesBuild ? <Navigate to={portalPath("staff", "/dashboard")} replace /> : <Auth allowedRoles={STAFF_AUTH_ROLES} />}
          />
          <Route
            path="/fee/auth"
            element={user && portalMatchesBuild ? <Navigate to={portalPath("fee", "/dashboard")} replace /> : <Auth allowedRoles={FEE_AUTH_ROLES} />}
          />
        </>
      )}

      {mode === "combined" && (
        <>
          <Route path="/dashboard" element={<PortalRedirect path="/dashboard" />} />
          <Route path="/students" element={<PortalRedirect path="/students" />} />
          <Route path="/notices" element={<PortalRedirect path="/notices" />} />
          <Route path="/profile" element={<PortalRedirect path="/profile" />} />
          <Route path="/attendance" element={<PortalRedirect path="/attendance" />} />
          <Route path="/homework" element={<PortalRedirect path="/homework" />} />
          <Route path="/schedule" element={<PortalRedirect path="/schedule" />} />
          <Route path="/reports" element={<PortalRedirect path="/reports" />} />
          <Route path="/users" element={<PortalRedirect path="/users" />} />
          <Route path="/fee-structure" element={<PortalRedirect path="/fee-structure" />} />
          <Route path="/time-table" element={<PortalRedirect path="/time-table" />} />
          <Route path="/academic-calendar" element={<PortalRedirect path="/academic-calendar" />} />
          <Route path="/audit" element={<PortalRedirect path="/audit" />} />
          <Route path="/fee-analytics" element={<PortalRedirect path="/fee-analytics" />} />
          <Route path="/settings" element={<PortalRedirect path="/settings" />} />
          <Route path="/staff-login" element={<PortalRedirect path="/staff-login" />} />
          <Route path="/fee" element={<Navigate to="/fee/dashboard" replace />} />
          <Route path="/course-fees" element={<PortalRedirect path="/course-fees" />} />
          <Route path="/books-fees" element={<PortalRedirect path="/books-fees" />} />
          <Route path="/transport-fees" element={<PortalRedirect path="/transport-fees" />} />
          <Route path="/fee-history" element={<PortalRedirect path="/fee-history" />} />
          <Route path="/pending-fees" element={<PortalRedirect path="/pending-fees" />} />
          <Route path="/accessories" element={<PortalRedirect path="/accessories" />} />
          <Route path="/accessories/history" element={<PortalRedirect path="/accessories/history" />} />
          <Route path="/accessories/uniform" element={<PortalRedirect path="/accessories/uniform" />} />
          <Route path="/accessories/uniform/inventory" element={<PortalRedirect path="/accessories/uniform/inventory" />} />
          <Route path="/sms" element={<PortalRedirect path="/sms" />} />
          <Route path="/receipt" element={<PortalRedirect path="/receipt" />} />
          <Route path="/db-check" element={<PortalRedirect path="/db-check" />} />
          <Route path="/schema-check" element={<PortalRedirect path="/schema-check" />} />
        </>
      )}

      {portalRoutes
        .filter((route) => route.portals.some((portalType) => allowedPortals.includes(portalType)))
        .flatMap((route) =>
          mode === "combined"
            ? route.portals
                .filter((portalType) => allowedPortals.includes(portalType))
                .map((portalType) => (
                  <Route
                    key={`${portalType}${route.path}`}
                    path={portalPath(portalType, route.path)}
                    element={<ProtectedRoute mode={mode}>{route.element}</ProtectedRoute>}
                  />
                ))
            : [
                <Route
                  key={route.path}
                  path={route.path}
                  element={<ProtectedRoute mode={mode}>{route.element}</ProtectedRoute>}
                />,
              ]
        )}

      {mode === "combined" ? (
        <>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/staff" element={<Navigate to="/staff/dashboard" replace />} />
          <Route path="/admin/*" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/staff/*" element={<Navigate to="/staff/dashboard" replace />} />
        </>
      ) : (
        <Route path="*" element={<NotFound />} />
      )}

      {mode === "combined" && <Route path="*" element={<NotFound />} />}
      </Routes>
    </Suspense>
  );
};

type AppShellProps = {
  mode?: AppMode;
};

export function AppShell({ mode = "combined" }: AppShellProps) {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes mode={mode} />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

const App = () => <AppShell />;

export default App;
