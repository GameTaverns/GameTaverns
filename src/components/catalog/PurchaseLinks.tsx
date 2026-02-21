import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/backend/client";

interface PurchaseLink {
  id: string;
  retailer_name: string;
  url: string;
  retailer_logo_url: string | null;
}

interface PurchaseLinksProps {
  catalogId: string;
}

export function PurchaseLinks({ catalogId }: PurchaseLinksProps) {
  const { data: links } = useQuery({
    queryKey: ["purchase-links", catalogId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_purchase_links" as any)
        .select("id, retailer_name, url, retailer_logo_url")
        .eq("catalog_id", catalogId)
        .eq("status", "approved")
        .order("retailer_name");
      if (error) throw error;
      return (data ?? []) as unknown as PurchaseLink[];
    },
    enabled: !!catalogId,
  });

  if (!links || links.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
        >
          {link.retailer_logo_url ? (
            <img src={link.retailer_logo_url} alt={link.retailer_name} className="h-4 w-4 rounded-sm object-contain" />
          ) : (
            <ShoppingCart className="h-4 w-4" />
          )}
          {link.retailer_name}
        </a>
      ))}
    </div>
  );
}
