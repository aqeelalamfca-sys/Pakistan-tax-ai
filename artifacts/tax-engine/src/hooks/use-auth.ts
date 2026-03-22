import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function useAuth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("tax_engine_token");

  const { data: user, isLoading, error } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    },
  });

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        localStorage.removeItem("tax_engine_token");
        queryClient.clear();
        setLocation("/login");
        toast({ title: "Logged out successfully" });
      },
      onError: () => {
        // Fallback clear if network fails
        localStorage.removeItem("tax_engine_token");
        queryClient.clear();
        setLocation("/login");
      }
    }
  });

  useEffect(() => {
    if (!token || error) {
      localStorage.removeItem("tax_engine_token");
      if (window.location.pathname !== '/login') {
        setLocation("/login");
      }
    }
  }, [token, error, setLocation]);

  return {
    user,
    isLoading: isLoading || (!user && !!token),
    isAuthenticated: !!user,
    logout: () => logoutMutation.mutate(),
    isLoggingOut: logoutMutation.isPending
  };
}

// Helper to check roles based on standard RBAC hierarchy
const ROLE_HIERARCHY: Record<string, number> = {
  CLIENT_USER: 1,
  ASSOCIATE: 2,
  SENIOR: 3,
  REVIEWER: 4,
  TAX_MANAGER: 5,
  PARTNER: 6,
  FIRM_ADMIN: 7,
  SUPER_ADMIN: 8,
};

export function hasRequiredRole(userRole?: string, requiredRole?: string) {
  if (!userRole || !requiredRole) return false;
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}
