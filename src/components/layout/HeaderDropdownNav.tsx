import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Library, Users, Calendar, Settings, ChevronDown,
  BookOpen, ArrowLeftRight, Search, Globe, MapPin,
  MessageSquarePlus, UserPlus, List, Trophy, Scale,
  Ticket, CalendarDays, User, HelpCircle,
  Zap, Dice5, PlusCircle, ClipboardList, Newspaper,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { TenantLink } from "@/components/TenantLink";
import { getPlatformUrl, getLibraryUrl } from "@/hooks/useTenantUrl";
import { useMyLibrary, useUserProfile } from "@/hooks/useLibrary";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface NavMenuProps {
  label: string;
  icon: React.ElementType;
  items: {
    href?: string;
    label: string;
    icon: React.ElementType;
    onClick?: () => void;
    separator?: boolean;
  }[];
}

function NavDropdown({ label, icon: Icon, items }: NavMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 px-2.5 gap-1 text-cream/80 hover:text-cream hover:bg-wood-medium/40 text-xs font-medium"
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">{label}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="min-w-[180px] bg-wood-dark/95 backdrop-blur-md border-wood-medium/50 text-cream"
      >
        {items.map((item, idx) => {
          if (item.separator) {
            return <DropdownMenuSeparator key={`sep-${idx}`} className="bg-wood-medium/30" />;
          }
          const ItemIcon = item.icon;
          if (item.onClick) {
            return (
              <DropdownMenuItem
                key={item.label}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
                className="gap-2 text-xs text-cream/80 hover:text-cream focus:text-cream focus:bg-wood-medium/40 cursor-pointer"
              >
                <ItemIcon className="h-3.5 w-3.5" />
                {item.label}
              </DropdownMenuItem>
            );
          }
          return (
            <DropdownMenuItem key={item.label} asChild className="gap-2 text-xs text-cream/80 hover:text-cream focus:text-cream focus:bg-wood-medium/40 cursor-pointer">
              <TenantLink href={item.href!} onClick={() => setOpen(false)}>
                <ItemIcon className="h-3.5 w-3.5" />
                {item.label}
              </TenantLink>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function HeaderDropdownNav() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { data: library } = useMyLibrary();
  const { data: profile } = useUserProfile();
  const navigate = useNavigate();

  if (!isAuthenticated) return null;

  const libraryHref = library ? getLibraryUrl(library.slug, "/") : getPlatformUrl("/create-library");

  const menus: NavMenuProps[] = [
    {
      label: t('nav.library', 'Library'),
      icon: Library,
      items: [
        { href: libraryHref, label: t('nav.myLibrary', 'My Library'), icon: Library },
        { href: getPlatformUrl("/dashboard/collection"), label: t('nav.manageMyLibrary', 'Manage My Library'), icon: BookOpen },
        { href: getPlatformUrl("/dashboard/lending"), label: t('nav.lending', 'Lending'), icon: ArrowLeftRight },
        { href: getPlatformUrl("/dashboard/insights"), label: t('nav.insights', 'Insights'), icon: ClipboardList },
        { separator: true, label: 's1', icon: Library },
        { href: getPlatformUrl("/catalog"), label: t('nav.catalog', 'Game Catalog'), icon: Search },
      ],
    },
    {
      label: t('nav.social', 'Social'),
      icon: Users,
      items: [
        { href: getPlatformUrl("/directory"), label: t('nav.libraryDirectory', 'Library Directory'), icon: Globe },
        { href: getPlatformUrl("/clubs"), label: t('nav.clubDirectory', 'Club Directory'), icon: UserPlus },
        { href: getPlatformUrl("/near-me"), label: t('nav.nearMe', 'Near Me'), icon: MapPin },
        { separator: true, label: 's2', icon: Users },
        { href: getPlatformUrl("/community"), label: t('nav.forums', 'Community Forums'), icon: MessageSquarePlus },
        
        { href: getPlatformUrl("/lists"), label: t('nav.curatedLists', 'Curated Lists'), icon: List },
        { separator: true, label: 's3', icon: Users },
        { href: getPlatformUrl("/news"), label: t('nav.news', 'News & Reviews'), icon: Newspaper },
      ],
    },
    {
      label: t('nav.events', 'Events'),
      icon: Calendar,
      items: [
        { href: getPlatformUrl("/events"), label: t('nav.browseEvents', 'Browse Events'), icon: CalendarDays },
        { href: getPlatformUrl("/convention"), label: t('nav.conventions', 'Conventions'), icon: Ticket },
        { href: getPlatformUrl("/dashboard/community"), label: t('nav.myEvents', 'My Events'), icon: Calendar },
      ],
    },
    {
      label: t('nav.quickActions', 'Quick Actions'),
      icon: Zap,
      items: [
        { href: getPlatformUrl("/dashboard/collection"), label: t('nav.logPlay', 'Log a Play'), icon: ClipboardList },
        { href: getPlatformUrl("/picker"), label: t('nav.randomPicker', 'Random Picker'), icon: Dice5 },
        { href: getPlatformUrl("/create-library"), label: t('nav.createLibrary', 'Create Library'), icon: PlusCircle },
      ],
    },
    {
      label: t('nav.settings', 'Settings'),
      icon: Settings,
      items: [
        { href: getPlatformUrl("/dashboard/settings"), label: t('nav.accountSettings', 'Account Settings'), icon: Settings },
        ...(profile?.username
          ? [{ href: getPlatformUrl(`/u/${profile.username}`), label: t('nav.myProfile', 'My Profile'), icon: User }]
          : []),
        { href: getPlatformUrl("/achievements"), label: t('nav.achievements', 'Achievements'), icon: Trophy },
        { separator: true, label: 's4', icon: Settings },
        { href: getPlatformUrl("/docs"), label: t('nav.helpDocs', 'Help & Docs'), icon: HelpCircle },
        { href: getPlatformUrl("/legal"), label: t('nav.legal', 'Legal'), icon: Scale },
      ],
    },
  ];

  return (
    <nav className="hidden md:flex items-center gap-0.5" aria-label="Main navigation">
      {menus.map((menu) => (
        <NavDropdown key={menu.label} {...menu} />
      ))}
    </nav>
  );
}
