import { useState, useRef, type ReactNode } from "react";
import { proxiedImageUrl, directImageUrl, isBggImage } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface GameImageProps {
  imageUrl: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  priority?: boolean;
  fallback?: ReactNode;
  /** Responsive sizes attribute for srcset-like behavior */
  sizes?: string;
}

// Tiny 1x1 transparent SVG used as blur placeholder
const BLUR_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='%23374151'/%3E%3C/svg%3E";

export function GameImage({
  imageUrl,
  alt,
  className = "",
  loading = "lazy",
  priority = false,
  fallback,
  sizes,
}: GameImageProps) {
  const [useFallback, setUseFallback] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const getImageSrc = () => {
    // For BGG images: start with proxy, fall back to direct
    // For other images: start with direct, fall back to proxy
    if (isBggImage(imageUrl)) {
      if (useFallback) return directImageUrl(imageUrl);
      return proxiedImageUrl(imageUrl);
    } else {
      if (useFallback) return proxiedImageUrl(imageUrl);
      return directImageUrl(imageUrl);
    }
  };

  const handleImageError = () => {
    if (!useFallback) {
      setUseFallback(true);
    } else {
      setImageError(true);
    }
  };

  if (imageError) {
    return <>{fallback ?? null}</>;
  }

  return (
    <img
      ref={imgRef}
      src={getImageSrc()}
      alt={alt}
      loading={loading}
      decoding={priority ? "sync" : "async"}
      // @ts-expect-error - fetchpriority is a valid HTML attribute but React types don't include it
      fetchpriority={priority ? "high" : "auto"}
      referrerPolicy="no-referrer"
      onError={handleImageError}
      onLoad={() => setLoaded(true)}
      sizes={sizes}
      className={cn(
        className,
        "transition-opacity duration-300",
        !loaded && !priority && "opacity-0"
      )}
      style={!loaded && !priority ? { backgroundImage: `url("${BLUR_PLACEHOLDER}")`, backgroundSize: "cover" } : undefined}
    />
  );
}
