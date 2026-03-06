import { useState } from "react";
import { supabase } from "@/integrations/backend/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Barcode, Save, Loader2, ScanBarcode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BarcodeScannerDialog } from "@/components/clubs/BarcodeScannerDialog";

interface CatalogUpcEditorProps {
  catalogId: string;
  currentUpc: string | null;
}

export function CatalogUpcEditor({ catalogId, currentUpc }: CatalogUpcEditorProps) {
  const [upc, setUpc] = useState(currentUpc || "");
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    const trimmed = upc.trim();
    if (trimmed && (trimmed.length < 8 || trimmed.length > 14)) {
      toast({ title: "Invalid UPC", description: "UPC should be 8-14 digits.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("game_catalog")
        .update({ upc: trimmed || null })
        .eq("id", catalogId);
      if (error) throw error;
      toast({ title: "UPC saved", description: trimmed ? `UPC set to ${trimmed}` : "UPC cleared." });
    } catch (e: any) {
      toast({ title: "Failed to save UPC", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleBarcodeScanned = (code: string) => {
    setUpc(code.replace(/[^0-9]/g, ""));
    setShowScanner(false);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Barcode className="h-4 w-4" />
            UPC / EAN Barcode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={upc}
              onChange={(e) => setUpc(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 681706711003"
              maxLength={14}
              inputMode="numeric"
              className="font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowScanner(true)}
              title="Scan barcode"
            >
              <ScanBarcode className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || upc === (currentUpc || "")}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Sets the UPC for this catalog entry. Copies added to libraries will inherit this barcode.
          </p>
        </CardContent>
      </Card>

      <BarcodeScannerDialog
        open={showScanner}
        onOpenChange={setShowScanner}
        onScan={handleBarcodeScanned}
        title="Scan UPC Barcode"
        description="Point your camera at the game's UPC/EAN barcode, or type it manually."
      />
    </>
  );
}
