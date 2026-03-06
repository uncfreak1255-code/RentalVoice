// Smart extraction of property knowledge from Hostaway listing data
// Pulls REAL data from the Hostaway API instead of using defaults

import { Property, PropertyKnowledge } from './store';
import type { HostawayListing } from './hostaway';

interface ExtractedField {
  field: keyof PropertyKnowledge;
  value: string;
  source: string; // Where we found it
}

/**
 * Format a numeric hour (0-23) into a human-readable time string.
 * Hostaway stores times as integers: 16 = 4:00 PM, 10 = 10:00 AM
 */
function formatHour(hour: number | undefined | null): string | null {
  if (hour == null || hour < 0 || hour > 23) return null;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h}:00 ${ampm}`;
}

/**
 * Extract property knowledge fields from Hostaway listing detail data.
 * Uses REAL API data — WiFi, check-in/out times, house rules, pricing, etc.
 * Falls back to sensible defaults only when the API doesn't provide a field.
 */
export function extractKnowledgeFromListing(
  property: Property,
  existingKnowledge?: PropertyKnowledge,
  listingDetail?: HostawayListing | null
): { extracted: Partial<PropertyKnowledge>; details: ExtractedField[] } {
  const extracted: Partial<PropertyKnowledge> = {};
  const details: ExtractedField[] = [];
  const d = listingDetail; // shorthand

  // Property ID is always set
  extracted.propertyId = property.id;

  // ── WiFi ──
  if (!existingKnowledge?.wifiName && d?.wifiName) {
    extracted.wifiName = d.wifiName;
    details.push({ field: 'wifiName', value: d.wifiName, source: 'Hostaway listing' });
  }
  if (!existingKnowledge?.wifiPassword && d?.wifiPassword) {
    extracted.wifiPassword = d.wifiPassword;
    details.push({ field: 'wifiPassword', value: '••••••', source: 'Hostaway listing' });
  }

  // ── Check-in / Check-out times ──
  if (!existingKnowledge?.checkInTime) {
    const checkIn = formatHour(d?.checkInTimeStart);
    if (checkIn) {
      extracted.checkInTime = checkIn;
      details.push({ field: 'checkInTime', value: checkIn, source: 'Hostaway listing' });
    } else {
      extracted.checkInTime = '3:00 PM';
      details.push({ field: 'checkInTime', value: '3:00 PM', source: 'Default (no API data)' });
    }
  }
  if (!existingKnowledge?.checkOutTime) {
    const checkOut = formatHour(d?.checkOutTime);
    if (checkOut) {
      extracted.checkOutTime = checkOut;
      details.push({ field: 'checkOutTime', value: checkOut, source: 'Hostaway listing' });
    } else {
      extracted.checkOutTime = '11:00 AM';
      details.push({ field: 'checkOutTime', value: '11:00 AM', source: 'Default (no API data)' });
    }
  }

  // ── House Rules ──
  if (!existingKnowledge?.houseRules) {
    if (d?.houseRules && d.houseRules.trim().length > 10) {
      extracted.houseRules = d.houseRules.trim();
      details.push({ field: 'houseRules', value: `${d.houseRules.substring(0, 60)}…`, source: 'Hostaway listing' });
    } else {
      extracted.houseRules = [
        '• No smoking inside the property',
        '• No parties or events',
        '• Quiet hours: 10 PM - 8 AM',
        '• Lock all doors when leaving',
      ].join('\n');
      details.push({ field: 'houseRules', value: 'Standard house rules', source: 'Default (no API data)' });
    }
  }

  // ── Check-in Instructions ──
  if (!existingKnowledge?.checkInInstructions) {
    const parts: string[] = [];
    if (d?.checkInInstructions && d.checkInInstructions.trim().length > 5) {
      parts.push(d.checkInInstructions.trim());
    }
    // Append door code if available
    const doorCode = d?.doorCode || d?.doorSecurityCode;
    if (doorCode) {
      parts.push(`\nDoor/Access Code: ${doorCode}`);
    }
    if (parts.length > 0) {
      extracted.checkInInstructions = parts.join('\n');
      details.push({ field: 'checkInInstructions', value: 'Custom instructions' + (doorCode ? ' + door code' : ''), source: 'Hostaway listing' });
    } else {
      const time = extracted.checkInTime || existingKnowledge?.checkInTime || '3:00 PM';
      extracted.checkInInstructions = `Welcome to ${property.name}!\n\nYour check-in time is ${time}.\nPlease reach out if you need any assistance.`;
      details.push({ field: 'checkInInstructions', value: 'Default template', source: 'Property name + check-in time' });
    }
  }

  // ── Check-out Instructions ──
  if (!existingKnowledge?.checkOutInstructions) {
    if (d?.checkOutInstructions && d.checkOutInstructions.trim().length > 5) {
      extracted.checkOutInstructions = d.checkOutInstructions.trim();
      details.push({ field: 'checkOutInstructions', value: 'Custom instructions', source: 'Hostaway listing' });
    } else {
      const time = extracted.checkOutTime || existingKnowledge?.checkOutTime || '11:00 AM';
      extracted.checkOutInstructions = [
        `Thank you for staying at ${property.name}!`,
        '',
        `• Please check out by ${time}`,
        '• Leave used towels in the bathtub',
        '• Run the dishwasher if used',
        '• Take out trash to the bins',
        '• Lock all doors and leave keys inside',
      ].join('\n');
      details.push({ field: 'checkOutInstructions', value: 'Default template', source: 'Property name + check-out time' });
    }
  }

  // ── Amenities → Appliance Guide ──
  // Cap to top 10 amenities in compact format to avoid prompt bloat.
  // Previously stored 40+ items as bullet points, inflating every AI prompt.
  if (!existingKnowledge?.applianceGuide && d?.listingAmenities && d.listingAmenities.length > 0) {
    const amenityNames = d.listingAmenities
      .map(a => a.amenityName)
      .filter(Boolean) as string[];
    if (amenityNames.length > 0) {
      const topAmenities = amenityNames.slice(0, 10);
      extracted.applianceGuide = 'Key amenities: ' + topAmenities.join(', ');
      details.push({ field: 'applianceGuide', value: `${topAmenities.length} of ${amenityNames.length} amenities`, source: 'Hostaway listing amenities' });
    }
  }

  // ── Parking Info ──
  if (!existingKnowledge?.parkingInfo && property.address) {
    extracted.parkingInfo = `Property located at: ${property.address}`;
    details.push({ field: 'parkingInfo', value: extracted.parkingInfo, source: 'Property address' });
  }

  // ── Description → Local Recommendations ──
  if (!existingKnowledge?.localRecommendations && d?.description) {
    const desc = d.description.trim();
    if (desc.length > 50) {
      extracted.localRecommendations = desc;
      details.push({ field: 'localRecommendations', value: `${desc.substring(0, 60)}…`, source: 'Hostaway listing description' });
    }
  }

  // ── Pet Policy (from house rules text parsing) ──
  if (!existingKnowledge?.petPolicy && d?.houseRules) {
    const rules = d.houseRules.toLowerCase();
    if (rules.includes('pet') || rules.includes('dog') || rules.includes('animal')) {
      // Extract pet-related sentences
      const lines = d.houseRules.split(/[\n.]+/).filter(
        l => /pet|dog|animal|cat/i.test(l) && l.trim().length > 5
      );
      if (lines.length > 0) {
        extracted.petPolicy = lines.map(l => l.trim()).join('\n');
        details.push({ field: 'petPolicy', value: `${lines.length} pet rule(s)`, source: 'Parsed from house rules' });
      }
    }
  }

  // ── Custom Notes (capacity, pricing, stay info) ──
  if (!existingKnowledge?.customNotes && d) {
    const notes: string[] = [];

    const capacity = d.personCapacity || d.maxNumberOfGuests;
    if (capacity) notes.push(`Max guests: ${capacity}`);

    const bedrooms = d.numberOfBedrooms || d.bedrooms;
    const bathrooms = d.numberOfBathrooms || d.bathrooms;
    if (bedrooms) notes.push(`Bedrooms: ${bedrooms}`);
    if (bathrooms) notes.push(`Bathrooms: ${bathrooms}`);

    if (d.price) notes.push(`Nightly rate: $${d.price}`);
    if (d.cleaningFee) notes.push(`Cleaning fee: $${d.cleaningFee}`);
    const extraFee = d.priceForExtraPerson || d.extraPersonFee;
    if (extraFee) notes.push(`Extra person fee: $${extraFee}/night`);
    if (d.minimumStay) notes.push(`Minimum stay: ${d.minimumStay} night(s)`);

    if (d.cancellationPolicy) notes.push(`Cancellation: ${d.cancellationPolicy}`);

    // Bed types
    if (d.listingBedTypes && d.listingBedTypes.length > 0) {
      const bedInfo = d.listingBedTypes.map(bt => {
        const name = bt.bedTypeName || `Type ${bt.bedTypeId}`;
        const room = bt.roomName ? ` (${bt.roomName})` : '';
        return `${bt.quantity}x ${name}${room}`;
      }).join(', ');
      notes.push(`Beds: ${bedInfo}`);
    }

    if (notes.length > 0) {
      extracted.customNotes = notes.join('\n');
      details.push({ field: 'customNotes', value: `${notes.length} property details`, source: 'Hostaway listing data' });
    }
  }

  // ── Default tone ──
  if (!existingKnowledge?.tonePreference) {
    extracted.tonePreference = 'friendly';
    details.push({ field: 'tonePreference', value: 'friendly', source: 'Recommended default' });
  }

  return { extracted, details };
}

/**
 * Count how many fields will be filled (only empty ones).
 */
export function countImportableFields(
  property: Property,
  existingKnowledge?: PropertyKnowledge,
  listingDetail?: HostawayListing | null
): number {
  const { details } = extractKnowledgeFromListing(property, existingKnowledge, listingDetail);
  return details.length;
}
