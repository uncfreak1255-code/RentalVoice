import type { Conversation } from './store';

export function isRenderableUnreadConversation(conversation: Conversation): boolean {
  const guestName = conversation.guest?.name?.trim();
  const lastSender = conversation.lastMessage?.sender;
  const lastContent = conversation.lastMessage?.content?.trim();

  if (conversation.unreadCount <= 0) return false;
  if (!guestName || guestName === 'Unknown Guest') return false;
  if (!lastContent) return false;
  if (lastSender === 'host') return false;

  return true;
}
