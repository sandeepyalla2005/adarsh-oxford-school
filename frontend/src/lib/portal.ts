export type PortalType = "admin" | "staff" | "fee";
export type AppBuildMode = "combined" | PortalType;

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

import { PORTAL_MODE } from "./runtime-config";

export function getAppBuildMode(): AppBuildMode {
  // 1. Check early-injected environment variable (available in <head>)
  if (PORTAL_MODE === "admin" || PORTAL_MODE === "staff" || PORTAL_MODE === "fee") {
    return PORTAL_MODE;
  }

  // 2. Fallback to DOM attribute (available after <body> parses)
  if (typeof document === "undefined") {
    return "combined";
  }

  const value = document.body?.dataset?.portalBuild;
  if (value === "admin" || value === "staff" || value === "fee") {
    return value;
  }

  // 3. Ultimate Fallback: Port Detection (Definitive on localhost)
  const port = typeof window !== "undefined" ? window.location.port : "";
  if (port === "8080") return "admin";
  if (port === "8081") return "staff";
  if (port === "8082") return "fee";

  return "combined";
}

export function getPortalFromPath(pathname: string): PortalType {
  if (pathname.startsWith("/fee")) return "fee";
  if (pathname.startsWith("/staff")) return "staff";
  return "admin";
}

export function getCurrentPortal(pathname: string): PortalType {
  const buildMode = getAppBuildMode();
  if (buildMode === "combined") {
    return getPortalFromPath(pathname);
  }

  return buildMode;
}

export function getPortalFromRole(role: string | null | undefined): PortalType {
  const buildMode = getAppBuildMode();
  
  if (role === "admin") {
    // Admins can log into any portal; redirect to the current one
    if (buildMode === "fee") return "fee";
    if (buildMode === "staff") return "staff";
    return "admin";
  }
  
  if (role === "feeInCharge") return "fee";
  return "staff";
}

export function getPortalBasePath(portal: PortalType): string {
  if (portal === "admin") return "/admin";
  if (portal === "fee") return "/fee";
  return "/staff";
}

export function portalPath(portal: PortalType, path: string): string {
  const normalized = normalizePath(path);
  const buildMode = getAppBuildMode();

  if (buildMode === portal) {
    return normalized;
  }

  return `${getPortalBasePath(portal)}${normalized}`;
}

export function getAuthRedirectPath(): string {
  const buildMode = getAppBuildMode();
  if (buildMode === "admin") return "/admin/auth";
  if (buildMode === "fee") return "/fee/auth";
  if (buildMode === "staff") return "/staff/auth";
  return "/auth";
}

export function getPortalAuthPath(portal: PortalType): string {
  const buildMode = getAppBuildMode();
  if (buildMode === portal) {
    return "/auth";
  }

  return `${getPortalBasePath(portal)}/auth`;
}

export function getPortalDashboardPath(role: string | null | undefined): string {
  return portalPath(getPortalFromRole(role), "/dashboard");
}
