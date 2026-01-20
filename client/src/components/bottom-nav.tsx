import { Map, Calendar, User, AlertTriangle, LayoutDashboard } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";

export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();

  const citizenNavItems = [
    { path: "/map", label: t('map'), icon: Map, testId: "nav-map" },
    { path: "/reservations", label: t('myReservations'), icon: Calendar, testId: "nav-reservations" },
    { path: "/report", label: t('report'), icon: AlertTriangle, testId: "nav-report" },
    { path: "/profile", label: t('profile'), icon: User, testId: "nav-profile" },
  ];

  const driverNavItems = [
    { path: "/driver", label: t('driverDashboard'), icon: LayoutDashboard, testId: "nav-dashboard" },
    { path: "/map", label: t('map'), icon: Map, testId: "nav-map" },
    { path: "/report", label: t('report'), icon: AlertTriangle, testId: "nav-report" },
    { path: "/profile", label: t('profile'), icon: User, testId: "nav-profile" },
  ];

  const navItems = user?.role === "driver" ? driverNavItems : citizenNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-card-border z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              href={item.path}
              data-testid={item.testId}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-md transition-colors min-w-[64px] ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover-elevate"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
