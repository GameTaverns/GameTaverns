import { useState, type ReactNode } from "react";
import { proxiedImageUrl, directImageUrl, isBggImage } from "@/lib/utils";

interface GameImageProps {
  imageUrl: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  priority?: boolean;
  fallback?: ReactNode;
}

export function GameImage({
  imageUrl,
  alt,
  className = "",
  loading = "lazy",
  priority = false,
  fallback,
}: GameImageProps) {
  const [useFallback, setUseFallback] = useState(false);
  const [imageError, setImageError] = useState(false);

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
      src={getImageSrc()}
      alt={alt}
      loading={loading}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      referrerPolicy="no-referrer"
      onError={handleImageError}
      className={className}
    />
  );
}
