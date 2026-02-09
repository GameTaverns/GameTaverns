import { SiteForumCard } from "./SiteForumCard";
import { LibraryForumCard } from "./LibraryForumCard";

export function CommunityTab() {
  return (
    <div className="space-y-6">
      {/* Site-Wide Forums */}
      <SiteForumCard />

      {/* Library-Specific Forums */}
      <LibraryForumCard />
    </div>
  );
}
