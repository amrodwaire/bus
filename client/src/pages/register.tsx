import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Bus, ArrowRight, ArrowLeft, Eye, EyeOff, User, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";

type UserRole = "citizen" | "driver";

export default function Register() {
  const [, setLocation] = useLocation();
  const { register } = useAuth();
  const { toast } = useToast();
  const { t, isRTL } = useLanguage();
  
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
    
    if (!formData.username || !formData.password || !formData.fullName || !formData.phone) {
      toast({
        title: t('error'),
        description: t('fillRequiredFields'),
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: t('error'),
        description: t('passwordsDontMatch'),
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: t('error'),
        description: t('passwordTooShort'),
        variant: "destructive",
      });
      return;
    }

    if (role === "driver" && !formData.licenseNumber) {
      toast({
        title: t('error'),
        description: t('enterLicenseNumber'),
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
        title: t('accountCreated'),
        description: t('welcomeToApp'),
      });
      setLocation(role === "driver" ? "/driver" : "/map");
    } else {
      toast({
        title: t('registerFailed'),
        description: t('usernameTaken'),
        variant: "destructive",
      });
    }
  };

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  if (step === "role") {
    return (
      <div className="min-h-screen bg-background">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <BackArrow className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>

        <div className="px-4 py-8">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Bus className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">{t('createAccount')}</h1>
              <p className="text-muted-foreground mt-2">{t('selectRole')}</p>
            </div>

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
                    <h3 className="font-bold text-lg">{t('citizen')}</h3>
                    <p className="text-sm text-muted-foreground">{t('citizenDesc')}</p>
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
                    <h3 className="font-bold text-lg">{t('driver')}</h3>
                    <p className="text-sm text-muted-foreground">{t('driverDesc')}</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="text-center mt-8">
              <p className="text-muted-foreground">
                {t('haveAccount')}{" "}
                <Link href="/login" className="text-primary font-medium hover:underline" data-testid="link-login">
                  {t('login')}
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
      <header className="flex items-center justify-between p-4 border-b border-border">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setStep("role")}
          data-testid="button-back"
        >
          <BackArrow className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <div className="px-4 py-6">
        <div className="max-w-sm mx-auto">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              {role === "citizen" ? (
                <User className="h-6 w-6 text-primary" />
              ) : (
                <Truck className="h-6 w-6 text-primary" />
              )}
            </div>
            <h1 className="text-xl font-bold">
              {role === "citizen" ? t('registerAsCitizen') : t('registerAsDriver')}
            </h1>
          </div>

          <Card className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t('fullName')} *</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder={t('enterFullName')}
                  value={formData.fullName}
                  onChange={handleChange}
                  data-testid="input-fullname"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('phone')} *</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="07XXXXXXXX"
                  value={formData.phone}
                  onChange={handleChange}
                  data-testid="input-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nationalId">{t('nationalId')}</Label>
                <Input
                  id="nationalId"
                  name="nationalId"
                  type="text"
                  placeholder={t('nationalIdOptional')}
                  value={formData.nationalId}
                  onChange={handleChange}
                  data-testid="input-nationalid"
                />
              </div>

              {role === "driver" && (
                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">{t('licenseNumber')} *</Label>
                  <Input
                    id="licenseNumber"
                    name="licenseNumber"
                    type="text"
                    placeholder={t('enterPlateNumber')}
                    value={formData.licenseNumber}
                    onChange={handleChange}
                    data-testid="input-license"
                  />
                </div>
              )}

              <div className="border-t border-border pt-4 mt-4">
                <p className="text-sm text-muted-foreground mb-4">{t('loginCredentials')}</p>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">{t('username')} *</Label>
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      placeholder={t('chooseUsername')}
                      value={formData.username}
                      onChange={handleChange}
                      data-testid="input-username"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">{t('password')} *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={t('atLeast6Chars')}
                        value={formData.password}
                        onChange={handleChange}
                        data-testid="input-password"
                        className={isRTL ? "pl-10" : "pr-10"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute ${isRTL ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground`}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t('confirmPassword')} *</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder={t('reenterPassword')}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      data-testid="input-confirm-password"
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
                {isLoading ? t('registering') : t('createAccount')}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
