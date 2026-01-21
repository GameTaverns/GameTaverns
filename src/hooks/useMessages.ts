/**
 * Re-export PocketBase messages hooks
 * This maintains backward compatibility with existing imports.
 */
export {
  useMessages,
  useUnreadMessageCount,
  useMarkMessageRead,
  useDeleteMessage,
} from './useMessagesPocketBase';

// Re-export GameMessageWithGame as GameMessage for backward compatibility
export type { GameMessageWithGame as GameMessage } from './useMessagesPocketBase';
