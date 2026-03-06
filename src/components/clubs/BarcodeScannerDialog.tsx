import { useState, useEffect, useRef, useCallback, useId } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Camera, Keyboard, Loader2, AlertCircle, ScanBarcode } from "lucide-react";

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string) => void;
  title?: string;
  description?: string;
}

export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onScan,
  title = "Scan Barcode",
  description = "Point your camera at a UPC/EAN barcode, or type it manually.",
}: BarcodeScannerDialogProps) {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScannedRef = useRef(false);
  const consecutiveReadsRef = useRef<{ code: string; count: number }>({ code: "", count: 0 });
  const scanRegionId = useId().replace(/:/g, "");

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (!containerRef.current || scannerRef.current) return;

    setError(null);
    setScanning(true);

    try {
      // Dynamic import to avoid SSR issues
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.QR_CODE,
      ];

      const scanner = new Html5Qrcode(scanRegionId, {
        verbose: false,
        formatsToSupport,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: { ideal: "environment" } },
        {
          fps: 10,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
            width: Math.floor(viewfinderWidth * 0.92),
            height: Math.floor(Math.max(140, Math.min(viewfinderHeight * 0.42, 220))),
          }),
          disableFlip: false,
        },
        (decodedText) => {
          if (hasScannedRef.current) return;

          const raw = decodedText?.trim?.() || "";
          const numeric = raw.replace(/[^0-9]/g, "");
          const result = numeric.length >= 8 ? numeric : raw;
          if (!result) return;

          // Require 3 consecutive reads of the same code to confirm
          const prev = consecutiveReadsRef.current;
          if (prev.code === result) {
            prev.count++;
          } else {
            consecutiveReadsRef.current = { code: result, count: 1 };
          }

          if (consecutiveReadsRef.current.count < 3) return;

          hasScannedRef.current = true;
          onScan(result);
          stopScanner();
          onOpenChange(false);
        },
        () => {
          // Scan failure (expected while no barcode is in frame yet)
        }
      );
    } catch (err: any) {
      setScanning(false);
      if (
        err?.toString?.()?.includes("NotAllowedError") ||
        err?.toString?.()?.includes("Permission")
      ) {
        setError("Camera access denied. Please allow camera access or use manual entry.");
        setMode("manual");
      } else if (err?.toString?.()?.includes("NotFoundError")) {
        setError("No camera found. Use manual entry instead.");
        setMode("manual");
      } else {
        setError("Could not read barcode from camera. Try moving farther back, improving light, or use manual entry.");
        setMode("manual");
      }
    }
  }, [onScan, onOpenChange, stopScanner, scanRegionId]);

  useEffect(() => {
    if (open) {
      hasScannedRef.current = false;
    }

    if (open && mode === "camera") {
      // Small delay for DOM to mount
      const timeout = setTimeout(startScanner, 300);
      return () => {
        clearTimeout(timeout);
        stopScanner();
      };
    } else {
      stopScanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (code.length >= 8) {
      onScan(code);
      setManualCode("");
      onOpenChange(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      hasScannedRef.current = false;
      stopScanner();
      setManualCode("");
      setError(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ScanBarcode className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-2">
          <Button
            size="sm"
            variant={mode === "camera" ? "default" : "outline"}
            onClick={() => setMode("camera")}
            className="gap-1.5 flex-1"
          >
            <Camera className="h-4 w-4" />
            Camera
          </Button>
          <Button
            size="sm"
            variant={mode === "manual" ? "default" : "outline"}
            onClick={() => setMode("manual")}
            className="gap-1.5 flex-1"
          >
            <Keyboard className="h-4 w-4" />
            Manual
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {mode === "camera" ? (
          <div className="space-y-3">
            <div
              ref={containerRef}
              className="relative rounded-lg overflow-hidden bg-muted aspect-[2/1]"
            >
              <div id={scanRegionId} className="w-full h-full" />
              {scanning && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Scanning line animation */}
                  <div className="absolute inset-x-4 top-1/2 h-0.5 bg-primary/80 animate-pulse" />
                </div>
              )}
              {!scanning && !error && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Hold the barcode steady within the frame
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Enter UPC/EAN barcode..."
                value={manualCode}
                onChange={(e) =>
                  setManualCode(e.target.value.replace(/[^0-9]/g, ""))
                }
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                className="font-mono text-lg tracking-widest"
                maxLength={14}
                autoFocus
              />
              <Button
                onClick={handleManualSubmit}
                disabled={manualCode.trim().length < 8}
              >
                Look Up
              </Button>
            </div>
            <div className="flex gap-2 justify-center">
              <Badge variant="outline" className="text-xs">
                UPC-A (12 digits)
              </Badge>
              <Badge variant="outline" className="text-xs">
                EAN-13 (13 digits)
              </Badge>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
