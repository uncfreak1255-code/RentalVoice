/**
 * PMS Module Index
 * 
 * Single import point for all PMS-related functionality.
 * Usage: import { getActiveProvider, PMS_PROVIDERS, createHostawayAdapter } from '@/lib/pms';
 */

export {
  // Types
  type PMSProviderId,
  type PMSProvider,
  type PMSProviderInfo,
  type PMSCredentialField,
  type PMSConnectionStatus,
  type PMSReservation,
  type PMSListingDetail,

  // Registry & management
  PMS_PROVIDERS,
  setActiveProvider,
  getActiveProvider,
  getProviderInfo,
} from './pms-provider';

export { createHostawayAdapter, HostawayAdapter } from './hostaway-adapter';
