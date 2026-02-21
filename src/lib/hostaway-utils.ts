/**
 * Shared Hostaway conversion utilities
 * Single source of truth for converting Hostaway API types to app models.
 */

import type { Property, Message } from './store';
import type { HostawayListing, HostawayMessage } from './hostaway';

/** Convert a Hostaway listing to an app Property */
export function convertListingToProperty(listing: HostawayListing): Property {
  return {
    id: String(listing.id),
    name: listing.name || listing.externalListingName || 'Unnamed Property',
    address: [listing.address, listing.city, listing.state].filter(Boolean).join(', '),
    image: listing.thumbnailUrl || listing.picture,
  };
}

/**
 * Detect channel platform from Hostaway conversation data.
 * Checks channelId first (most reliable), then channelName/source strings.
 * Hostaway channel IDs: Airbnb=2000, Vrbo/HomeAway=2016, Booking.com=2002
 */
export function getChannelPlatform(
  channelName?: string,
  channelId?: number,
  source?: string
): 'airbnb' | 'booking' | 'vrbo' | 'direct' {
  const name = (channelName || '').toLowerCase();
  const src = (source || '').toLowerCase();

  if (channelId) {
    if (channelId === 2000) return 'airbnb';
    if (channelId === 2016) return 'vrbo';
    if (channelId === 2002) return 'booking';
  }

  if (name.includes('airbnb') || src.includes('airbnb')) return 'airbnb';
  if (name.includes('booking') || src.includes('booking')) return 'booking';
  if (name.includes('vrbo') || name.includes('homeaway') || src.includes('vrbo') || src.includes('homeaway')) return 'vrbo';

  return 'direct';
}

/** Convert a Hostaway message to an app Message */
export function convertHostawayMessage(msg: HostawayMessage, conversationId: string): Message {
  return {
    id: String(msg.id),
    conversationId,
    content: msg.body || '',
    sender: msg.isIncoming ? 'guest' : 'host',
    timestamp: new Date(msg.sentOn || msg.insertedOn),
    isRead: true,
  };
}
