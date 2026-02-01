import { useEffect, useRef } from "react";

interface QRCodeProps {
  value: string;
  size?: number;
}

export default function QRCode({ value, size = 200 }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    // Dynamically import qrcode library
    import("qrcode").then((QRCodeLib) => {
      QRCodeLib.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
    }).catch((err) => {
      console.error("Failed to generate QR code:", err);
    });
  }, [value, size]);

  return (
    <canvas 
      ref={canvasRef} 
      width={size} 
      height={size}
      className="rounded"
    />
  );
}
