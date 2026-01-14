import { useState } from "react";
import { proxiedImageUrl, directImageUrl } from "@/lib/utils";

interface GameImageProps {
  imageUrl: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  priority?: boolean;
}

export function GameImage({ 
  imageUrl, 
  alt, 
  className = "",
  loading = "lazy",
  priority = false 
}: GameImageProps) {
  const [useFallback, setUseFallback] = useState(false);
  const [imageError, setImageError] = useState(false);

  const getImageSrc = () => {
    if (useFallback) return proxiedImageUrl(imageUrl);
    return directImageUrl(imageUrl);
  };

  const handleImageError = () => {
    if (!useFallback) {
      setUseFallback(true);
    } else {
      setImageError(true);
    }
  };

  if (imageError) {
    return null; // Let parent handle fallback UI
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
