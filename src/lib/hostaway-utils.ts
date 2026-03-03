/**
 * Shared Hostaway conversion utilities
 * Single source of truth for converting Hostaway API types to app models.
 */

import type { Property, Message } from './store';
import type { HostawayListing, HostawayMessage } from './hostaway';

/**
 * Parse a Hostaway timestamp string into a proper Date.
 * Hostaway sends timestamps in UTC (e.g. "2026-03-03 19:03:00") but WITHOUT
 * a "Z" suffix. JavaScript's Date() treats these as LOCAL time, causing
 * a 5-hour offset for EST users. This helper ensures UTC interpretation
 * so toLocaleTimeString() correctly converts to the user's local timezone.
 */
export function parseHostawayTimestamp(ts: string | number | Date | undefined | null): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;

  // Unix epoch (seconds or milliseconds)
  if (typeof ts === 'number') {
    return ts < 10_000_000_000 ? new Date(ts * 1000) : new Date(ts);
  }

  // String timestamp — append "Z" if no timezone indicator present
  const str = String(ts).trim();
  if (
    !str.endsWith('Z') &&
    !str.includes('+') &&
    !/\d{2}:\d{2}:\d{2}-\d{2}/.test(str) && // No -HH:MM offset
    !/T.*[+-]\d{2}/.test(str) // No ISO offset
  ) {
    // Replace space between date and time with "T" for ISO compat, then add Z
    const isoStr = str.replace(' ', 'T') + 'Z';
    return new Date(isoStr);
  }

  return new Date(str);
}

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
    timestamp: parseHostawayTimestamp(msg.sentOn || msg.insertedOn),
    isRead: true,
  };
}

