import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Bus, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    const success = await login(username, password);
    
    setIsLoading(false);
    
    if (success) {
      toast({
        title: "تم تسجيل الدخول بنجاح",
        description: "مرحباً بك في كوستر",
      });
      setLocation("/map");
    } else {
      toast({
        title: "خطأ في تسجيل الدخول",
        description: "اسم المستخدم أو كلمة المرور غير صحيحة",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border">
        <Link href="/">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <ThemeToggle />
      </header>

      <div className="px-4 py-8">
        <div className="max-w-sm mx-auto">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Bus className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">تسجيل الدخول</h1>
            <p className="text-muted-foreground mt-2">ادخل بياناتك للمتابعة</p>
          </div>

          {/* Login Form */}
          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="أدخل اسم المستخدم"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  data-testid="input-username"
                  className="text-right"
                  dir="rtl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="أدخل كلمة المرور"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="input-password"
                    className="text-right pl-10"
                    dir="rtl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-submit-login"
              >
                {isLoading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
              </Button>
            </form>
          </Card>

          {/* Register Link */}
          <div className="text-center mt-6">
            <p className="text-muted-foreground">
              ليس لديك حساب؟{" "}
              <Link href="/register" className="text-primary font-medium hover:underline" data-testid="link-register">
                إنشاء حساب جديد
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
