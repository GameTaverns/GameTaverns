import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '@/i18n';
import { cn } from '@/lib/utils';

export function LanguageSelector() {
  const { i18n } = useTranslation();

  const currentLang = supportedLanguages.find(l => l.code === i18n.language)
    || supportedLanguages.find(l => i18n.language?.startsWith(l.code))
    || supportedLanguages[0];

  return (
    <div className="grid grid-cols-2 gap-2">
      {supportedLanguages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left",
            lang.code === currentLang.code
              ? "bg-primary/10 text-primary font-medium border border-primary/30"
              : "hover:bg-accent text-foreground border border-transparent"
          )}
        >
          <span>{lang.flag}</span>
          <span>{lang.label}</span>
        </button>
      ))}
    </div>
  );
}
