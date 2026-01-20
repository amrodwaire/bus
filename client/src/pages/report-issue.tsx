import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Bug, Route, MessageSquare, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { BottomNav } from "@/components/bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { apiRequest } from "@/lib/queryClient";

type IssueCategory = "technical" | "route" | "feedback";

export default function ReportIssue() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [selectedCategory, setSelectedCategory] = useState<IssueCategory | null>(null);
  const [description, setDescription] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");

  const categories = [
    {
      id: "technical" as IssueCategory,
      label: t('technical'),
      icon: Bug,
      description: t('technicalDesc'),
    },
    {
      id: "route" as IssueCategory,
      label: t('route'),
      icon: Route,
      description: t('routeDesc'),
    },
    {
      id: "feedback" as IssueCategory,
      label: t('feedback'),
      icon: MessageSquare,
      description: t('feedbackDesc'),
    },
  ];

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/reports", {
        userId: user?.id,
        category: selectedCategory,
        description,
      });
    },
    onSuccess: (data: any) => {
      setIsSubmitted(true);
      setTicketNumber(data.ticketNumber || `TKT-${Date.now().toString(36).toUpperCase()}`);
      toast({
        title: t('reportSubmitted'),
        description: t('reportSubmittedDesc'),
      });
    },
    onError: () => {
      toast({
        title: t('reportFailed'),
        description: t('error'),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCategory) {
      toast({
        title: t('error'),
        description: t('selectCategoryError'),
        variant: "destructive",
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: t('error'),
        description: t('describeIssue'),
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate();
  };

  const resetForm = () => {
    setSelectedCategory(null);
    setDescription("");
    setIsSubmitted(false);
    setTicketNumber("");
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-background border-b border-border">
          <div className="flex items-center justify-between p-4">
            <h1 className="font-bold text-lg">{t('reportIssue')}</h1>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="p-4">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="font-bold text-xl mb-2">{t('reportSubmitted')}</h2>
            <p className="text-muted-foreground mb-4">{t('reportSubmittedDesc')}</p>
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground mb-1">{t('ticketNumber')}</p>
              <p className="font-mono font-bold text-lg">{ticketNumber}</p>
            </div>
            <Button onClick={resetForm} data-testid="button-new-report">
              {t('newReport')}
            </Button>
          </Card>
        </div>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h1 className="font-bold text-lg">{t('reportIssue')}</h1>
              <p className="text-xs text-muted-foreground">{t('helpImprove')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        <div className="space-y-3">
          <Label className="text-base font-semibold">{t('issueType')}</Label>
          <div className="grid gap-3">
            {categories.map((category) => {
              const Icon = category.icon;
              const isSelected = selectedCategory === category.id;
              
              return (
                <Card
                  key={category.id}
                  className={`p-4 cursor-pointer transition-all ${
                    isSelected 
                      ? "ring-2 ring-primary bg-primary/5" 
                      : "hover-elevate"
                  }`}
                  onClick={() => setSelectedCategory(category.id)}
                  data-testid={`card-category-${category.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      isSelected 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted"
                    }`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{category.label}</h3>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="description" className="text-base font-semibold">
              {t('describeIssueLabel')}
            </Label>
            <span className={`text-xs ${description.length > 500 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {description.length}/500
            </span>
          </div>
          <Textarea
            id="description"
            placeholder={t('enterIssueDetails')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[150px] resize-none"
            data-testid="textarea-description"
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={submitMutation.isPending || !selectedCategory || !description.trim()}
          data-testid="button-submit-report"
        >
          {submitMutation.isPending ? (
            t('submitting')
          ) : (
            <>
              <Send className="h-4 w-4" />
              {t('submitReport')}
            </>
          )}
        </Button>
      </form>

      <BottomNav />
    </div>
  );
}
