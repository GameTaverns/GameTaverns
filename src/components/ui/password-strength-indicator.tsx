import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

const RULES = [
  { test: (pw: string) => pw.length >= 8, label: "At least 8 characters" },
  { test: (pw: string) => /[A-Z]/.test(pw), label: "One uppercase letter" },
  { test: (pw: string) => /[a-z]/.test(pw), label: "One lowercase letter" },
  { test: (pw: string) => /[0-9]/.test(pw), label: "One number" },
  { test: (pw: string) => /[^A-Za-z0-9]/.test(pw), label: "One special character" },
];

export function PasswordStrengthIndicator({ password, className }: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  return (
    <ul className={cn("space-y-1 text-xs", className)}>
      {RULES.map((rule) => {
        const passes = rule.test(password);
        return (
          <li key={rule.label} className={cn("flex items-center gap-1.5", passes ? "text-green-500" : "text-muted-foreground")}>
            {passes ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
