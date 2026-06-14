import {
  Car, Home, Laptop, Smartphone, Shirt, Sofa, Sparkles, Wheat,
  Briefcase, Wrench, PawPrint, Trophy, Baby, Package, type LucideIcon,
} from "lucide-react";
import { CATEGORIES } from "@/lib/format";

export const CATEGORY_META: Record<(typeof CATEGORIES)[number], { icon: LucideIcon; color: string }> = {
  "Vehicles":            { icon: Car,        color: "oklch(0.55 0.18 25)" },
  "Property":            { icon: Home,       color: "oklch(0.5 0.16 155)" },
  "Electronics":         { icon: Laptop,     color: "oklch(0.5 0.18 250)" },
  "Phones & Tablets":    { icon: Smartphone, color: "oklch(0.55 0.18 280)" },
  "Fashion":             { icon: Shirt,      color: "oklch(0.6 0.2 340)" },
  "Home & Furniture":    { icon: Sofa,       color: "oklch(0.55 0.14 60)" },
  "Health & Beauty":     { icon: Sparkles,   color: "oklch(0.65 0.16 10)" },
  "Food & Agriculture":  { icon: Wheat,      color: "oklch(0.6 0.16 100)" },
  "Jobs":                { icon: Briefcase,  color: "oklch(0.45 0.1 240)" },
  "Services":            { icon: Wrench,     color: "oklch(0.5 0.12 200)" },
  "Animals & Pets":      { icon: PawPrint,   color: "oklch(0.55 0.14 80)" },
  "Sports & Hobbies":    { icon: Trophy,     color: "oklch(0.65 0.16 50)" },
  "Babies & Kids":       { icon: Baby,       color: "oklch(0.65 0.14 20)" },
  "Other":               { icon: Package,    color: "oklch(0.5 0.02 250)" },
};