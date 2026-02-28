import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/backend/client";

interface MentionSuggestion {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface UseMentionAutocompleteOptions {
  value: string;
  onChange: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export function useMentionAutocomplete({ value, onChange, textareaRef }: UseMentionAutocompleteOptions) {
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const checkForMention = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    
    // Find the last @ that's either at start or preceded by whitespace
    const match = textBeforeCursor.match(/(^|\s)@(\w{0,30})$/);
    
    if (match) {
      const query = match[2];
      const start = cursorPos - query.length - 1; // include the @
      setMentionStart(start);
      setMentionQuery(query);
      
      if (query.length >= 1) {
        // Debounce the search
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
          const { data } = await supabase
            .from("user_profiles")
            .select("user_id, username, display_name, avatar_url")
            .not("username", "is", null)
            .ilike("username", `${query}%`)
            .limit(5);
          
          setSuggestions(data || []);
          setShowSuggestions((data?.length || 0) > 0);
        }, 200);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
      setMentionQuery("");
    }
  }, [value, textareaRef]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const selectSuggestion = useCallback((suggestion: MentionSuggestion) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursorPos);
    const newValue = `${before}@${suggestion.username} ${after}`;
    
    onChange(newValue);
    setShowSuggestions(false);
    setSuggestions([]);

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      const newPos = mentionStart + suggestion.username.length + 2; // @ + username + space
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    });
  }, [value, mentionStart, onChange, textareaRef]);

  const closeSuggestions = useCallback(() => {
    setShowSuggestions(false);
  }, []);

  return {
    suggestions,
    showSuggestions,
    mentionQuery,
    checkForMention,
    selectSuggestion,
    closeSuggestions,
  };
}

/** Extract @usernames from a caption string */
export function extractMentions(caption: string): string[] {
  const matches = caption.match(/(^|\s)@(\w+)/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.trim().slice(1).toLowerCase()))];
}

/** Resolve usernames to user_ids */
export async function resolveUsernames(usernames: string[]): Promise<Record<string, string>> {
  if (!usernames.length) return {};
  
  const { data } = await supabase
    .from("user_profiles")
    .select("user_id, username")
    .in("username", usernames);
  
  const map: Record<string, string> = {};
  for (const row of data || []) {
    if (row.username) map[row.username.toLowerCase()] = row.user_id;
  }
  return map;
}
