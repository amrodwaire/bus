import { Link } from "wouter";
import { Bus, Shield, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Welcome() {
  const features = [
    {
      icon: MapPin,
      title: "تتبع مباشر",
      description: "شاهد موقع الباصات على الخريطة لحظة بلحظة",
    },
    {
      icon: Clock,
      title: "حجز سريع",
      description: "احجز مقعدك مسبقاً واحصل على أولوية الركوب",
    },
    {
      icon: Shield,
      title: "موثوق وآمن",
      description: "تطبيق حكومي رسمي لقطاع النقل الأردني",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Bus className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl">كوستر</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Hero Section */}
      <section className="px-4 py-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Bus className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-4">مرحباً بك في كوستر</h1>
          <p className="text-muted-foreground text-lg mb-8">
            تطبيق النقل العام الأردني الرسمي - تتبع الباصات واحجز مقعدك بسهولة
          </p>
          
          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <Link href="/login">
              <Button className="w-full" size="lg" data-testid="button-login">
                تسجيل الدخول
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" className="w-full" size="lg" data-testid="button-register">
                إنشاء حساب جديد
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-8">
        <div className="max-w-md mx-auto space-y-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 text-center border-t border-border mt-8">
        <p className="text-sm text-muted-foreground">
          وزارة النقل - المملكة الأردنية الهاشمية
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          جميع الحقوق محفوظة © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
