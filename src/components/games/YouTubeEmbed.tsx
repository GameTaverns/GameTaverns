import { useState } from "react";
import { Play, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface YouTubeEmbedProps {
  videoUrl: string;
  title?: string;
}

/**
 * Extract YouTube video ID from various URL formats
 */
export const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /youtube\.com\/shorts\/([^&\s?]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  
  return null;
};

/**
 * Get YouTube thumbnail URL from video ID
 */
export const getYouTubeThumbnail = (videoId: string): string => {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
};

/**
 * Single YouTube video embed with lazy loading
 */
export const YouTubeEmbed = ({ videoUrl, title = "YouTube video" }: YouTubeEmbedProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoId = extractYouTubeId(videoUrl);
  
  if (!videoId) return null;
  
  const thumbnailUrl = getYouTubeThumbnail(videoId);
  
  return (
    <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
      {isPlaying ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      ) : (
        <button
          onClick={() => setIsPlaying(true)}
          className="w-full h-full group relative"
          aria-label={`Play ${title}`}
        >
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              // Fallback to medium quality if maxres doesn't exist
              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            }}
          />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-red-600 group-hover:bg-red-500 transition-colors flex items-center justify-center shadow-lg">
              <Play className="h-8 w-8 text-white fill-white ml-1" />
            </div>
          </div>
        </button>
      )}
    </div>
  );
};

interface YouTubeVideoListProps {
  videos: string[];
  title?: string;
}

/**
 * Display a grid of YouTube video embeds
 */
export const YouTubeVideoList = ({ videos, title = "Gameplay Videos" }: YouTubeVideoListProps) => {
  const validVideos = videos.filter((url) => extractYouTubeId(url));
  
  if (validVideos.length === 0) return null;
  
  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
        <Play className="h-4 w-4 text-primary" />
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {validVideos.map((url, index) => (
          <YouTubeEmbed key={index} videoUrl={url} title={`${title} ${index + 1}`} />
        ))}
      </div>
    </div>
  );
};

interface YouTubeVideoEditorProps {
  videos: string[];
  onChange: (videos: string[]) => void;
}

/**
 * Editor component for managing YouTube video URLs
 */
export const YouTubeVideoEditor = ({ videos, onChange }: YouTubeVideoEditorProps) => {
  const [newUrl, setNewUrl] = useState("");
  
  const handleAdd = () => {
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    
    const videoId = extractYouTubeId(trimmed);
    if (!videoId) {
      return; // Invalid URL, could show toast here
    }
    
    if (!videos.includes(trimmed)) {
      onChange([...videos, trimmed]);
    }
    setNewUrl("");
  };
  
  const handleRemove = (index: number) => {
    onChange(videos.filter((_, i) => i !== index));
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://youtube.com/watch?v=... or https://youtu.be/..."
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>
      
      {videos.length > 0 && (
        <div className="space-y-2">
          {videos.map((url, index) => {
            const videoId = extractYouTubeId(url);
            return (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {videoId && (
                      <img
                        src={`https://img.youtube.com/vi/${videoId}/default.jpg`}
                        alt="Video thumbnail"
                        className="w-20 h-14 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground truncate">{url}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default YouTubeEmbed;
