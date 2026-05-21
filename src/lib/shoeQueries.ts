import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ShoeRow = Tables<"shoes">;

export async function fetchShoeBySlug(slug: string): Promise<ShoeRow | null> {
  const { data, error } = await supabase
    .from("shoes")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchAllShoes(): Promise<ShoeRow[]> {
  const { data, error } = await supabase
    .from("shoes")
    .select("*")
    .not("image_url", "is", null)
    .neq("image_url", "")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchShoesByBrand(brandName: string): Promise<ShoeRow[]> {
  const { data, error } = await supabase
    .from("shoes")
    .select("*")
    .eq("brand_name", brandName)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
