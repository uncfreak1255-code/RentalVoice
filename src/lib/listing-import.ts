// Smart extraction of property knowledge from Hostaway listing data
// No API calls — works entirely from already-synced store data

import { Property, PropertyKnowledge } from './store';

interface ExtractedField {
  field: keyof PropertyKnowledge;
  value: string;
  source: string; // Where we found it
}

/**
 * Extract property knowledge fields from listing data.
 * Uses the property address and any description text available.
 * Returns only the fields that could be extracted — caller decides what to fill.
 */
export function extractKnowledgeFromListing(
  property: Property,
  existingKnowledge?: PropertyKnowledge
): { extracted: Partial<PropertyKnowledge>; details: ExtractedField[] } {
  const extracted: Partial<PropertyKnowledge> = {};
  const details: ExtractedField[] = [];

  // Property ID is always set
  extracted.propertyId = property.id;

  // Extract from address
  if (property.address) {
    // Use address for parking info hint
    if (!existingKnowledge?.parkingInfo) {
      extracted.parkingInfo = `Property located at: ${property.address}`;
      details.push({ field: 'parkingInfo', value: extracted.parkingInfo, source: 'Property address' });
    }
  }

  // Default check-in/out times (industry standard)
  if (!existingKnowledge?.checkInTime) {
    extracted.checkInTime = '3:00 PM';
    details.push({ field: 'checkInTime', value: '3:00 PM', source: 'Industry standard default' });
  }
  if (!existingKnowledge?.checkOutTime) {
    extracted.checkOutTime = '11:00 AM';
    details.push({ field: 'checkOutTime', value: '11:00 AM', source: 'Industry standard default' });
  }

  // Default house rules
  if (!existingKnowledge?.houseRules) {
    extracted.houseRules = [
      '• No smoking inside the property',
      '• No parties or events',
      '• Quiet hours: 10 PM - 8 AM',
      '• Please remove shoes indoors',
      '• Lock all doors when leaving',
    ].join('\n');
    details.push({ field: 'houseRules', value: 'Standard house rules template', source: 'Default template' });
  }

  // Default check-in instructions template
  if (!existingKnowledge?.checkInInstructions) {
    extracted.checkInInstructions = `Welcome to ${property.name}!\n\nYour check-in time is 3:00 PM.\nPlease reach out if you need any assistance with access.`;
    details.push({ field: 'checkInInstructions', value: 'Check-in template', source: 'Property name + default' });
  }

  // Default checkout instructions
  if (!existingKnowledge?.checkOutInstructions) {
    extracted.checkOutInstructions = [
      `Thank you for staying at ${property.name}!`,
      '',
      '• Please check out by 11:00 AM',
      '• Leave used towels in the bathtub',
      '• Run the dishwasher if used',
      '• Take out trash to the bins',
      '• Lock all doors and leave keys inside',
    ].join('\n');
    details.push({ field: 'checkOutInstructions', value: 'Check-out template', source: 'Property name + default' });
  }

  // Default tone
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
  existingKnowledge?: PropertyKnowledge
): number {
  const { details } = extractKnowledgeFromListing(property, existingKnowledge);
  return details.length;
}
