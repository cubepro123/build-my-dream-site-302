import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FeatureFlags {
  boost_enabled: boolean;
  boost_price_per_view_ngn: number;
  boost_max_duration_days: number;
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["feature_flags"],
    queryFn: async (): Promise<FeatureFlags> => {
      const { data } = await supabase.from("feature_flags").select("*");
      const map = new Map((data ?? []).map((r: any) => [r.key, r]));
      const get = (k: string) => map.get(k) as any;
      return {
        boost_enabled: !!get("boost_enabled")?.bool_value,
        boost_price_per_view_ngn: Number(get("boost_price_per_view_ngn")?.num_value ?? 2),
        boost_max_duration_days: Number(get("boost_max_duration_days")?.num_value ?? 7),
      };
    },
    staleTime: 60_000,
  });
}

export function useIsAdmin() {
  return useQuery({
    queryKey: ["is_admin"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    staleTime: 60_000,
  });
}
