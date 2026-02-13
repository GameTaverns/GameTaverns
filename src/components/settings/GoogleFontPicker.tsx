import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Search, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Popular Google Fonts curated list — shown first before search results
const POPULAR_FONTS = [
  "MedievalSharp", "Cinzel", "Playfair Display", "Merriweather", "Lora",
  "IM Fell English", "Roboto", "Open Sans", "Montserrat", "Oswald",
  "Raleway", "Poppins", "Nunito", "Source Sans 3", "Roboto Slab",
  "Inter", "Crimson Text", "Libre Baskerville", "Cormorant Garamond",
  "Josefin Sans", "Bitter", "Vollkorn", "Spectral", "Alegreya",
  "Fira Sans", "PT Serif", "Cabin", "Arvo", "Karla", "Quicksand",
  "Rubik", "Barlow", "Noto Serif", "Ubuntu", "Mukta",
  "DM Sans", "Work Sans", "Outfit", "Space Grotesk", "Geologica",
];

// Load a Google Font dynamically
function loadGoogleFont(fontFamily: string) {
  const id = `gf-${fontFamily.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

interface GoogleFontPickerProps {
  /** Currently selected font family */
  value: string;
  /** Callback when a font is selected */
  onChange: (font: string) => void;
  /** Label for the picker */
  label: string;
  /** Placeholder for the search input */
  placeholder?: string;
}

export function GoogleFontPicker({
  value,
  onChange,
  label,
  placeholder = "Search Google Fonts...",
}: GoogleFontPickerProps) {
  const [search, setSearch] = useState("");
  const [allFonts, setAllFonts] = useState<string[]>(POPULAR_FONTS);
  const [isLoadingFonts, setIsLoadingFonts] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch full Google Fonts list when user starts searching
  useEffect(() => {
    if (search.length >= 2 && allFonts.length <= POPULAR_FONTS.length) {
      fetchAllFonts();
    }
  }, [search]);

  const fetchAllFonts = async () => {
    if (isLoadingFonts) return;
    setIsLoadingFonts(true);
    try {
      // Use the Google Fonts CSS API to get font list — we parse font names from a known list
      // For performance, we use a static curated list of ~400 most popular fonts
      const response = await fetch(
        "https://fonts.google.com/metadata/fonts"
      );
      if (response.ok) {
        const text = await response.text();
        // The metadata endpoint returns JSON with a leading )]}' prefix
        const json = JSON.parse(text.replace(/^\\)\\]\\}'\n/, ""));
        const fontNames: string[] = json.familyMetadataList
          ?.map((f: any) => f.family)
          .filter(Boolean) || [];
        if (fontNames.length > 0) {
          setAllFonts(fontNames);
        }
      }
    } catch (e) {
      // Fallback: keep popular fonts
      console.warn("Could not fetch Google Fonts list, using curated set");
    } finally {
      setIsLoadingFonts(false);
    }
  };

  // Filter fonts based on search
  const filteredFonts = useMemo(() => {
    if (!search.trim()) {
      return POPULAR_FONTS;
    }
    const q = search.toLowerCase();
    return allFonts
      .filter((f) => f.toLowerCase().includes(q))
      .slice(0, 50); // Limit results for performance
  }, [search, allFonts]);

  // Load fonts that are visible
  const loadedFontsRef = useRef(new Set<string>());
  useEffect(() => {
    filteredFonts.forEach((font) => {
      if (!loadedFontsRef.current.has(font)) {
        loadGoogleFont(font);
        loadedFontsRef.current.add(font);
      }
    });
  }, [filteredFonts]);

  // Load selected font on mount
  useEffect(() => {
    if (value) loadGoogleFont(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = useCallback((font: string) => {
    onChange(font);
    setIsOpen(false);
    setSearch("");
  }, [onChange]);

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label className="text-sm font-medium">{label}</Label>
      
      {/* Selected font display / trigger */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="w-full flex items-center justify-between px-3 py-2 border rounded-md bg-background text-sm hover:bg-muted/50 transition-colors text-left"
      >
        <span style={{ fontFamily: `"${value}", sans-serif` }}>
          {value || "Select a font..."}
        </span>
        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="relative z-50">
          <div className="absolute top-0 left-0 right-0 bg-popover border rounded-md shadow-lg overflow-hidden">
            {/* Search input */}
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={placeholder}
                  className="pl-8 h-9"
                />
              </div>
              {isLoadingFonts && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading all fonts...
                </div>
              )}
            </div>

            {/* Font list */}
            <ScrollArea className="max-h-64">
              <div className="p-1">
                {!search.trim() && (
                  <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Popular Fonts
                  </div>
                )}
                {filteredFonts.length === 0 ? (
                  <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                    No fonts found
                  </div>
                ) : (
                  filteredFonts.map((font) => (
                    <button
                      key={font}
                      type="button"
                      onClick={() => handleSelect(font)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-sm text-left hover:bg-muted/50 transition-colors",
                        value === font && "bg-primary/10"
                      )}
                    >
                      <span
                        className="text-sm truncate"
                        style={{ fontFamily: `"${font}", sans-serif` }}
                      >
                        {font}
                      </span>
                      {value === font && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
