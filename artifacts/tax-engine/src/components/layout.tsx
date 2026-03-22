import React from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, Users, FolderOpen, BookOpen, 
  ShieldAlert, Settings, LogOut, ChevronDown, Menu, UserCircle, Database, Brain
} from "lucide-react";
import { useAuth, hasRequiredRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, minRole: "CLIENT_USER" },
  { href: "/clients", label: "Clients", icon: Users, minRole: "ASSOCIATE" },
  { href: "/engagements", label: "Engagements", icon: FolderOpen, minRole: "CLIENT_USER" },
  { href: "/rules", label: "Tax Rules", icon: BookOpen, minRole: "TAX_MANAGER" },
  { href: "/audit", label: "Audit Logs", icon: ShieldAlert, minRole: "FIRM_ADMIN" },
  { href: "/vault", label: "Knowledge Vault", icon: Database, minRole: "SUPER_ADMIN" },
  { href: "/ai-settings", label: "AI Settings", icon: Brain, minRole: "SUPER_ADMIN" },
  { href: "/users", label: "Team & Users", icon: Settings, minRole: "FIRM_ADMIN" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null; // The useAuth hook handles the redirect
  }

  const visibleNavItems = NAV_ITEMS.filter(item => hasRequiredRole(user.role, item.minRole));

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:flex lg:flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border/50">
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="h-8 w-8 mr-3" />
          <span className="text-xl font-display font-bold text-sidebar-foreground tracking-tight">TaxEngine<span className="text-primary">.ai</span></span>
        </div>
        
        <div className="px-6 py-4">
          <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-4">
            {user.firmName || "Workspace"}
          </div>
          <nav className="space-y-1">
            {visibleNavItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} className={cn(
                  "flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-black/20" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )} onClick={() => setIsMobileMenuOpen(false)}>
                  <item.icon className={cn(
                    "w-5 h-5 mr-3 transition-colors",
                    isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
                  )} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-sidebar-border/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-sidebar-accent transition-colors text-left">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
                  {user.firstName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-sidebar-foreground/50 truncate">{user.role.replace('_', ' ')}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-sidebar-foreground/50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer flex w-full">
                  <UserCircle className="w-4 h-4 mr-2" /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="lg:hidden mr-4" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-semibold text-foreground hidden sm:block">
              {visibleNavItems.find(i => location === i.href || (i.href !== "/" && location.startsWith(i.href)))?.label || "Workspace"}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <span className={cn(
              "hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border",
              user.mfaEnabled ? "bg-green-100 text-green-800 border-green-200" : "bg-amber-100 text-amber-800 border-amber-200"
            )}>
              {user.mfaEnabled ? "MFA Active" : "MFA Disabled"}
            </span>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto bg-background p-4 sm:p-6 lg:p-8">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="max-w-7xl mx-auto"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
