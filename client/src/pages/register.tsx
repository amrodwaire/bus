import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Bus, ArrowRight, Eye, EyeOff, User, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";

type UserRole = "citizen" | "driver";

export default function Register() {
  const [, setLocation] = useLocation();
  const { register } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<"role" | "form">("role");
  const [role, setRole] = useState<UserRole>("citizen");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    phone: "",
    nationalId: "",
    licenseNumber: "",
  });

  const handleRoleSelect = (selectedRole: UserRole) => {
    setRole(selectedRole);
    setStep("form");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.username || !formData.password || !formData.fullName || !formData.phone) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "خطأ",
        description: "كلمتا المرور غير متطابقتين",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "خطأ",
        description: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
        variant: "destructive",
      });
      return;
    }

    if (role === "driver" && !formData.licenseNumber) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال رقم رخصة القيادة",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    const success = await register({
      username: formData.username,
      password: formData.password,
      fullName: formData.fullName,
      phone: formData.phone,
      role,
      nationalId: formData.nationalId || undefined,
      licenseNumber: formData.licenseNumber || undefined,
    });
    
    setIsLoading(false);
    
    if (success) {
      toast({
        title: "تم إنشاء الحساب بنجاح",
        description: "مرحباً بك في كوستر",
      });
      setLocation(role === "driver" ? "/driver" : "/map");
    } else {
      toast({
        title: "خطأ في إنشاء الحساب",
        description: "اسم المستخدم قد يكون مستخدماً مسبقاً",
        variant: "destructive",
      });
    }
  };

  if (step === "role") {
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
          <div className="max-w-md mx-auto">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Bus className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">إنشاء حساب جديد</h1>
              <p className="text-muted-foreground mt-2">اختر نوع الحساب</p>
            </div>

            {/* Role Selection */}
            <div className="grid gap-4">
              <Card 
                className="p-6 cursor-pointer hover-elevate active-elevate-2"
                onClick={() => handleRoleSelect("citizen")}
                data-testid="card-role-citizen"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <User className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">مواطن</h3>
                    <p className="text-sm text-muted-foreground">
                      للبحث عن الباصات وحجز المقاعد
                    </p>
                  </div>
                </div>
              </Card>

              <Card 
                className="p-6 cursor-pointer hover-elevate active-elevate-2"
                onClick={() => handleRoleSelect("driver")}
                data-testid="card-role-driver"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center">
                    <Truck className="h-7 w-7 text-accent-foreground" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">سائق باص</h3>
                    <p className="text-sm text-muted-foreground">
                      لإدارة الباص والطريق والركاب
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Login Link */}
            <div className="text-center mt-8">
              <p className="text-muted-foreground">
                لديك حساب بالفعل؟{" "}
                <Link href="/login" className="text-primary font-medium hover:underline" data-testid="link-login">
                  تسجيل الدخول
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setStep("role")}
          data-testid="button-back"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
        <ThemeToggle />
      </header>

      <div className="px-4 py-6">
        <div className="max-w-sm mx-auto">
          {/* Title */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              {role === "citizen" ? (
                <User className="h-6 w-6 text-primary" />
              ) : (
                <Truck className="h-6 w-6 text-primary" />
              )}
            </div>
            <h1 className="text-xl font-bold">
              {role === "citizen" ? "تسجيل كمواطن" : "تسجيل كسائق باص"}
            </h1>
          </div>

          {/* Registration Form */}
          <Card className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">الاسم الكامل *</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="أدخل اسمك الكامل"
                  value={formData.fullName}
                  onChange={handleChange}
                  data-testid="input-fullname"
                  className="text-right"
                  dir="rtl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">رقم الهاتف *</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="07XXXXXXXX"
                  value={formData.phone}
                  onChange={handleChange}
                  data-testid="input-phone"
                  className="text-right"
                  dir="rtl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nationalId">الرقم الوطني</Label>
                <Input
                  id="nationalId"
                  name="nationalId"
                  type="text"
                  placeholder="الرقم الوطني (اختياري)"
                  value={formData.nationalId}
                  onChange={handleChange}
                  data-testid="input-nationalid"
                  className="text-right"
                  dir="rtl"
                />
              </div>

              {role === "driver" && (
                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">رقم رخصة القيادة *</Label>
                  <Input
                    id="licenseNumber"
                    name="licenseNumber"
                    type="text"
                    placeholder="أدخل رقم الرخصة"
                    value={formData.licenseNumber}
                    onChange={handleChange}
                    data-testid="input-license"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
              )}

              <div className="border-t border-border pt-4 mt-4">
                <p className="text-sm text-muted-foreground mb-4">بيانات تسجيل الدخول</p>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">اسم المستخدم *</Label>
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      placeholder="اختر اسم مستخدم"
                      value={formData.username}
                      onChange={handleChange}
                      data-testid="input-username"
                      className="text-right"
                      dir="rtl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">كلمة المرور *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="6 أحرف على الأقل"
                        value={formData.password}
                        onChange={handleChange}
                        data-testid="input-password"
                        className="text-right pl-10"
                        dir="rtl"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">تأكيد كلمة المرور *</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="أعد إدخال كلمة المرور"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      data-testid="input-confirm-password"
                      className="text-right"
                      dir="rtl"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full mt-6"
                disabled={isLoading}
                data-testid="button-submit-register"
              >
                {isLoading ? "جاري إنشاء الحساب..." : "إنشاء الحساب"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
