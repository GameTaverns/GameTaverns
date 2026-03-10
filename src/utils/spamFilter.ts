/**
 * Lightweight spam filter for platform feedback.
 * Catches obvious commercial spam (SEO, crypto, marketing pitches)
 * without being aggressive enough to block legitimate users.
 */

// Phrases that are almost never in legitimate feedback
const SPAM_PHRASES = [
  // SEO / marketing spam
  "seo services", "seo agency", "search engine optimization",
  "link building", "backlink", "domain authority",
  "google ranking", "page rank", "keyword ranking",
  "digital marketing services", "social media marketing services",
  "guaranteed first page", "top of google",
  "increase your traffic", "boost your traffic",
  "website audit", "free seo audit", "free website audit",
  "content marketing services", "ppc campaign",
  "lead generation service",
  
  // Crypto / finance spam
  "bitcoin investment", "crypto investment", "forex trading",
  "binary options", "make money fast", "earn money online",
  "financial freedom", "passive income opportunity",
  "double your money",
  
  // Generic sales spam
  "we are offering", "we offer services",
  "special discount", "limited time offer",
  "act now", "don't miss out",
  "best price guaranteed",
  "call us today", "contact us today for",
  "visit our website at",
  "check out our portfolio",
  "we noticed your website",
  "i was browsing your site",
  "i came across your website",
  "we can help your business",
  "grow your business",
  "take your business to the next level",
];

// URL-heavy messages are suspicious in feedback
const URL_REGEX = /https?:\/\/[^\s]+/gi;
const EMAIL_REGEX = /[\w.-]+@[\w.-]+\.\w{2,}/gi;

export interface SpamCheckResult {
  isSpam: boolean;
  reason?: string;
}

export function checkForSpam(
  message: string,
  senderName: string,
  senderEmail: string
): SpamCheckResult {
  const lowerMessage = message.toLowerCase();
  const lowerName = senderName.toLowerCase();

  // 1. Check for known spam phrases
  for (const phrase of SPAM_PHRASES) {
    if (lowerMessage.includes(phrase)) {
      return { isSpam: true, reason: `Message contains a known spam pattern.` };
    }
  }

  // 2. Too many URLs (more than 2 links in feedback is suspicious)
  const urlMatches = message.match(URL_REGEX) || [];
  if (urlMatches.length > 2) {
    return { isSpam: true, reason: "Message contains too many links." };
  }

  // 3. Too many email addresses embedded in message body
  const emailMatches = message.match(EMAIL_REGEX) || [];
  if (emailMatches.length > 2) {
    return { isSpam: true, reason: "Message contains too many email addresses." };
  }

  // 4. Name looks like a company/service pitch (e.g., "SEO Expert John")
  const spamNamePatterns = ["seo", "marketing", "agency", "consultant", "freelancer"];
  if (spamNamePatterns.some(p => lowerName.includes(p))) {
    return { isSpam: true, reason: "Sender name appears to be a business solicitation." };
  }

  // 5. Message is mostly caps (shouting / scam vibes) — only for longer messages
  if (message.length > 50) {
    const upperCount = (message.match(/[A-Z]/g) || []).length;
    const letterCount = (message.match(/[a-zA-Z]/g) || []).length;
    if (letterCount > 0 && upperCount / letterCount > 0.7) {
      return { isSpam: true, reason: "Message appears to be mostly uppercase." };
    }
  }

  return { isSpam: false };
}
