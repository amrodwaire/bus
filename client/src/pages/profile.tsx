import { useLocation } from "wouter";
import { 
  User, 
  Phone, 
  IdCard, 
  LogOut, 
  ChevronLeft, 
  Shield,
  Bus,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="flex items-center justify-between p-4">
          <h1 className="font-bold text-lg">حسابي</h1>
          <ThemeToggle />
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Profile Card */}
        <Card className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-xl">{user.fullName}</h2>
              <Badge variant={user.role === "driver" ? "default" : "secondary"}>
                {user.role === "driver" ? "سائق باص" : "مواطن"}
              </Badge>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">اسم المستخدم</p>
                <p className="font-medium">{user.username}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Phone className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">رقم الهاتف</p>
                <p className="font-medium">{user.phone}</p>
              </div>
            </div>

            {user.nationalId && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <IdCard className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الرقم الوطني</p>
                  <p className="font-medium">{user.nationalId}</p>
                </div>
              </div>
            )}

            {user.role === "driver" && user.licenseNumber && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Bus className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">رقم رخصة القيادة</p>
                  <p className="font-medium">{user.licenseNumber}</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Menu Items */}
        <Card className="divide-y divide-border">
          <button 
            className="flex items-center justify-between w-full p-4 hover-elevate text-right"
            data-testid="button-privacy"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="font-medium">الخصوصية والأمان</span>
            </div>
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>

          <button 
            className="flex items-center justify-between w-full p-4 hover-elevate text-right"
            data-testid="button-terms"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="font-medium">الشروط والأحكام</span>
            </div>
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
        </Card>

        {/* Logout Button */}
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4 ml-2" />
          تسجيل الخروج
        </Button>

        {/* Footer */}
        <div className="text-center pt-4">
          <p className="text-xs text-muted-foreground">
            كوستر - تطبيق النقل العام الأردني
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            الإصدار 1.0.0
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
