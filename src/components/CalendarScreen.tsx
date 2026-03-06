import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Users,
  RefreshCw,
  Search,
  Eye,
  Lock,
  Home,
  DollarSign,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  SlideInRight,
} from 'react-native-reanimated';
import {
  format,
  addDays,
  isSameDay,
  isWithinInterval,
  parseISO,
  differenceInDays,
  addMonths,
  subMonths,
  isToday as dateFnsIsToday,
  startOfWeek,
} from 'date-fns';
import { useAppStore, type Property } from '@/lib/store';
import {
  fetchCalendarReservations,
  fetchListings,
  type HostawayListing,
} from '@/lib/hostaway';
import {
  getHostawayCalendarReservationsViaServer,
  getHostawayListingsViaServer,
  type HostawayListingRecord,
} from '@/lib/api-client';
import { isCommercial } from '@/lib/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LISTING_COLUMN_WIDTH = 110;
const DAY_COLUMN_WIDTH = 62;
const ROW_HEIGHT = 80;
const DATE_HEADER_HEIGHT = 50;
const PRICE_ROW_HEIGHT = 20;

type ViewMode = 'multi' | 'single';

interface CalendarEntry {
  id: number;
  listingId: number;
  type: 'reservation' | 'block';
  startDate: Date;
  endDate: Date;
  guestName?: string;
  guestCount?: number;
  totalPrice?: number;
  currency?: string;
  status?: string;
  channelName?: string;
  nights?: number;
  pricePerNight?: number;
}

interface CalendarScreenProps {
  onBack: () => void;
}

// OTA badge colors and icons
const getOTABadge = (channelName?: string) => {
  const ch = (channelName || '').toLowerCase();
  if (ch.includes('airbnb')) {
    return { color: '#FF5A5F', letter: 'A', bgColor: '#FF5A5F' };
  }
  if (ch.includes('booking')) {
    return { color: '#003580', letter: 'B', bgColor: '#003580' };
  }
  if (ch.includes('vrbo') || ch.includes('homeaway')) {
    return { color: '#3B82F6', letter: 'V', bgColor: '#3B82F6' };
  }
  if (ch.includes('hostaway') || ch.includes('direct')) {
    return { color: '#F59E0B', letter: 'H', bgColor: '#F59E0B' };
  }
  return { color: '#6B7280', letter: 'D', bgColor: '#6B7280' };
};

// Generate dates starting from a week before today
const generateDates = (currentMonth: Date): Date[] => {
  // Start from beginning of the week containing today
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 6 }); // Start from Saturday like Hostaway

  // Generate 60 days forward
  const dates: Date[] = [];
  for (let i = 0; i < 60; i++) {
    dates.push(addDays(weekStart, i));
  }
  return dates;
};

// Get daily price for a listing on a specific date
const getDailyPrice = (
  listingId: number,
  date: Date,
  entries: CalendarEntry[]
): number | null => {
  const entry = entries.find(
    e => e.listingId === listingId &&
    e.type === 'reservation' &&
    isWithinInterval(date, { start: e.startDate, end: e.endDate })
  );
  if (entry?.pricePerNight) {
    return entry.pricePerNight;
  }
  if (entry?.totalPrice && entry?.nights && entry.nights > 0) {
    return Math.round(entry.totalPrice / entry.nights);
  }
  return null;
};

export function CalendarScreen({ onBack }: CalendarScreenProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('multi');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  // Refs for synchronized scrolling
  const headerScrollRef = useRef<ScrollView>(null);
  const listingScrollRefs = useRef<{ [key: string]: ScrollView | null }>({});

  const properties = useAppStore((s) => s.properties);
  const setProperties = useAppStore((s) => s.setProperties);
  const accountId = useAppStore((s) => s.settings.accountId);
  const apiKey = useAppStore((s) => s.settings.apiKey);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const isCommercialMode = isCommercial;

  // Generate dates
  const dates = useMemo(() => generateDates(currentMonth), [currentMonth]);

  // Filter listings for single view
  const displayedListings = useMemo(() => {
    if (viewMode === 'single' && selectedListingId) {
      return properties.filter(p => p.id === selectedListingId);
    }
    return properties;
  }, [properties, viewMode, selectedListingId]);

  // Synchronized scroll handler (empty for now to avoid event loop freezing)
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Disabled to improve performance
  }, []);

  // Load calendar data
  const loadCalendarData = useCallback(async () => {
    if (isDemoMode) {
      // Generate demo data matching Hostaway style
      const demoEntries: CalendarEntry[] = [];
      const today = new Date();

      const demoGuests = [
        { name: 'Miranda Pi...', channel: 'Airbnb', guests: 2 },
        { name: 'Rosemary Santu...', channel: 'Airbnb', guests: 3 },
        { name: 'Kelly N...', channel: 'Airbnb', guests: 2 },
        { name: 'Duane Shurow', channel: 'Hostaway', guests: 2 },
        { name: 'Philip M...', channel: 'Airbnb', guests: 4 },
      ];

      properties.forEach((property, index) => {
        // Add reservations
        const guestData = demoGuests[index % demoGuests.length];
        const startOffset = index * 2 + Math.floor(Math.random() * 3);
        const nights = 3 + Math.floor(Math.random() * 4);

        demoEntries.push({
          id: index * 100 + 1,
          listingId: Number(property.id),
          type: 'reservation',
          startDate: addDays(today, startOffset),
          endDate: addDays(today, startOffset + nights),
          guestName: guestData.name,
          guestCount: guestData.guests,
          totalPrice: (150 + index * 50) * nights,
          pricePerNight: 150 + index * 50 + Math.floor(Math.random() * 100),
          currency: '$',
          status: 'confirmed',
          channelName: guestData.channel,
          nights: nights,
        });

        // Add some blocks
        if (index % 2 === 0) {
          demoEntries.push({
            id: index * 100 + 2,
            listingId: Number(property.id),
            type: 'block',
            startDate: addDays(today, startOffset + nights + 2),
            endDate: addDays(today, startOffset + nights + 4),
            status: 'blocked',
          });
        }

        // Add second reservation
        if (index % 3 === 0) {
          const secondStart = startOffset + nights + 6;
          const secondNights = 4;
          demoEntries.push({
            id: index * 100 + 3,
            listingId: Number(property.id),
            type: 'reservation',
            startDate: addDays(today, secondStart),
            endDate: addDays(today, secondStart + secondNights),
            guestName: demoGuests[(index + 2) % demoGuests.length].name,
            guestCount: 2,
            totalPrice: 800,
            pricePerNight: 200,
            currency: '$',
            status: 'confirmed',
            channelName: 'Airbnb',
            nights: secondNights,
          });
        }
      });

      setEntries(demoEntries);
      setIsLoading(false);
      return;
    }

    if (!isCommercialMode && (!accountId || !apiKey)) {
      setIsLoading(false);
      return;
    }

    try {
      console.log('[Calendar] Loading calendar data...');

      // Fetch listings if needed
      if (properties.length === 0) {
        const listings = isCommercialMode
          ? await getHostawayListingsViaServer()
          : await fetchListings(accountId!, apiKey!);
        const convertedProperties = listings.map((l: HostawayListing | HostawayListingRecord) => ({
          id: String(l.id),
          name: l.name || l.externalListingName || 'Unnamed Property',
          address: [l.address, l.city, l.state].filter(Boolean).join(', '),
          image: l.thumbnailUrl || l.picture || undefined,
        }));
        setProperties(convertedProperties);
      }

      // Fetch reservations for 3 months
      const startDate = format(subMonths(new Date(), 1), 'yyyy-MM-dd');
      const endDate = format(addMonths(new Date(), 2), 'yyyy-MM-dd');

      const reservations = isCommercialMode
        ? await getHostawayCalendarReservationsViaServer({ startDate, endDate })
        : await fetchCalendarReservations(accountId!, apiKey!, {
            startDate,
            endDate,
          });

      const calendarEntries: CalendarEntry[] = reservations.map((r) => {
        const nights = r.nights || differenceInDays(parseISO(r.departureDate), parseISO(r.arrivalDate));
        return {
          id: r.id,
          listingId: r.listingMapId,
          type: 'reservation' as const,
          startDate: parseISO(r.arrivalDate),
          endDate: parseISO(r.departureDate),
          guestName: r.guestName || `${r.guestFirstName || ''} ${r.guestLastName || ''}`.trim() || 'Guest',
          guestCount: (r.adults || 0) + (r.children || 0),
          totalPrice: r.totalPrice,
          pricePerNight: r.totalPrice && nights > 0 ? Math.round(r.totalPrice / nights) : undefined,
          currency: r.currency,
          status: r.status,
          channelName: r.channelName,
          nights: nights,
        };
      });

      setEntries(calendarEntries);
      console.log(`[Calendar] Loaded ${calendarEntries.length} entries`);
    } catch (error) {
      console.error('[Calendar] Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isDemoMode, isCommercialMode, accountId, apiKey, properties, setProperties]);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadCalendarData();
    setIsRefreshing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [loadCalendarData]);

  const handlePrevMonth = useCallback(() => {
    Haptics.selectionAsync();
    setCurrentMonth(prev => subMonths(prev, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    Haptics.selectionAsync();
    setCurrentMonth(prev => addMonths(prev, 1));
  }, []);

  const handleEntryPress = useCallback((entry: CalendarEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedEntry(entry);
  }, []);

  const selectedListing = useMemo(() => {
    if (selectedEntry) {
      return properties.find(p => Number(p.id) === selectedEntry.listingId);
    }
    return undefined;
  }, [selectedEntry, properties]);

  // Get entries for a specific listing
  const getEntriesForListing = useCallback((listingId: string) => {
    return entries.filter(e => e.listingId === Number(listingId));
  }, [entries]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#14B8A6" />
        <Text style={{ marginTop: 16, color: '#6B7280', fontSize: 14 }}>
          Loading calendar...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Hostaway-Style Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: '#FFFFFF',
          }}
        >
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#111827' }}>
            Calendar
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              onPress={() => {}}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Search size={24} color="#14B8A6" />
            </Pressable>
            <Pressable
              onPress={handleRefresh}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <RefreshCw size={24} color="#14B8A6" />
            </Pressable>
            <Pressable
              onPress={onBack}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                position: 'relative',
              })}
            >
              <Eye size={24} color="#14B8A6" />
              {/* Notification badge */}
              <View
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: '#EF4444',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#FFFFFF' }}>
                  2
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Month Picker & View Toggle Row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            gap: 12,
          }}
        >
          {/* Month Picker Button */}
          <Pressable
            onPress={() => {}}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              backgroundColor: '#FFFFFF',
            })}
          >
            <CalendarIcon size={18} color="#6B7280" />
            <Text style={{ fontSize: 15, fontWeight: '500', color: '#111827', marginLeft: 8 }}>
              {format(currentMonth, "MMM ''yy")}
            </Text>
          </Pressable>

          {/* Navigation arrows */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Pressable
              onPress={handlePrevMonth}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                padding: 8,
              })}
            >
              <ChevronLeft size={20} color="#6B7280" />
            </Pressable>
            <Pressable
              onPress={handleNextMonth}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                padding: 8,
              })}
            >
              <ChevronRight size={20} color="#6B7280" />
            </Pressable>
          </View>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Multi/Single Toggle */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: '#F3F4F6',
              borderRadius: 8,
              padding: 4,
            }}
          >
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setViewMode('multi');
              }}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 8,
                borderRadius: 6,
                backgroundColor: viewMode === 'multi' ? '#1F2937' : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: viewMode === 'multi' ? '#FFFFFF' : '#6B7280',
                }}
              >
                Multi
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setViewMode('single');
                if (properties.length > 0 && !selectedListingId) {
                  setSelectedListingId(properties[0].id);
                }
              }}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 8,
                borderRadius: 6,
                backgroundColor: viewMode === 'single' ? '#1F2937' : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: viewMode === 'single' ? '#FFFFFF' : '#6B7280',
                }}
              >
                Single
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Single View Listing Selector */}
        {viewMode === 'single' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
          >
            {properties.map((property) => {
              const isSelected = selectedListingId === property.id;
              return (
                <Pressable
                  key={property.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedListingId(property.id);
                  }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: isSelected ? '#14B8A6' : '#F3F4F6',
                    marginRight: 8,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: isSelected ? '#FFFFFF' : '#374151',
                    }}
                  >
                    {property.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Calendar Grid */}
        <View style={{ flex: 1 }}>
          {/* Fixed Header Row with Date Headers */}
          <View style={{ flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#E5E7EB' }}>
            {/* Today label cell */}
            <View
              style={{
                width: LISTING_COLUMN_WIDTH,
                height: DATE_HEADER_HEIGHT,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                borderRightWidth: 1,
                borderRightColor: '#E5E7EB',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>
                Today
              </Text>
            </View>

            {/* Scrollable date headers */}
            <ScrollView
              ref={headerScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEnabled={false}
              style={{ flex: 1 }}
            >
              {dates.map((date, index) => {
                const isCurrentDay = dateFnsIsToday(date);
                const dayName = format(date, 'EEE').toUpperCase();
                const dayNumber = format(date, 'd');

                return (
                  <View
                    key={index}
                    style={{
                      width: DAY_COLUMN_WIDTH,
                      height: DATE_HEADER_HEIGHT,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: isCurrentDay ? '#14B8A6' : '#FFFFFF',
                      borderRightWidth: 1,
                      borderRightColor: '#E5E7EB',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '500',
                        color: isCurrentDay ? '#FFFFFF' : '#6B7280',
                      }}
                    >
                      {dayName}
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '700',
                        color: isCurrentDay ? '#FFFFFF' : '#111827',
                      }}
                    >
                      {dayNumber}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* Scrollable Listing Rows */}
          <View style={{ flex: 1 }}>
            {displayedListings.length > 0 ? (
              <FlatList
                data={displayedListings}
                keyExtractor={(listing) => listing.id}
                windowSize={5}
                maxToRenderPerBatch={5}
                initialNumToRender={8}
                removeClippedSubviews={false}
                ListFooterComponent={<View style={{ height: 100 }} />}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    tintColor="#14B8A6"
                    colors={['#14B8A6']}
                  />
                }
                renderItem={({ item: listing }) => (
                  <ListingCalendarRow
                    listing={listing}
                    dates={dates}
                    entries={getEntriesForListing(listing.id)}
                    onEntryPress={handleEntryPress}
                    scrollRef={(ref) => {
                      listingScrollRefs.current[listing.id] = ref;
                    }}
                    onScroll={handleScroll}
                    allEntries={entries}
                  />
                )}
              />
            ) : (
              <ScrollView 
                contentContainerStyle={{ flex: 1, padding: 40, alignItems: 'center' }}
                refreshControl={
                  <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#14B8A6" colors={['#14B8A6']} />
                }
              >
                <Home size={48} color="#D1D5DB" />
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280', marginTop: 16 }}>
                  No listings found
                </Text>
                <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' }}>
                  Connect your Hostaway account to see your listings
                </Text>
              </ScrollView>
            )}
          </View>
        </View>

        {/* Reservation Detail Slide-out */}
        {selectedEntry && (
          <>
            <Pressable
              onPress={() => setSelectedEntry(null)}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
              }}
            />
            <ReservationDetail
              entry={selectedEntry}
              listing={selectedListing}
              onClose={() => setSelectedEntry(null)}
            />
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

// Listing Calendar Row Component
interface ListingCalendarRowProps {
  listing: Property;
  dates: Date[];
  entries: CalendarEntry[];
  onEntryPress: (entry: CalendarEntry) => void;
  scrollRef: (ref: ScrollView | null) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  allEntries: CalendarEntry[];
}

const ListingCalendarRow = React.memo(function ListingCalendarRow({
  listing,
  dates,
  entries,
  onEntryPress,
  scrollRef,
  onScroll,
  allEntries,
}: ListingCalendarRowProps) {
  // Get entry for a specific date
  const getEntryForDate = useCallback((date: Date) => {
    return entries.find(entry =>
      isWithinInterval(date, { start: entry.startDate, end: entry.endDate })
    );
  }, [entries]);

  // Check if date is start/end of entry
  const isStartOfEntry = (date: Date, entry: CalendarEntry) => isSameDay(date, entry.startDate);
  const isEndOfEntry = (date: Date, entry: CalendarEntry) => isSameDay(date, entry.endDate);

  // Calculate days from entry start
  const getDaysFromStart = (date: Date, entry: CalendarEntry) => {
    return differenceInDays(date, entry.startDate);
  };

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
      {/* Main row with listing name and calendar */}
      <View style={{ flexDirection: 'row', height: ROW_HEIGHT - PRICE_ROW_HEIGHT }}>
        {/* Listing name column */}
        <View
          style={{
            width: LISTING_COLUMN_WIDTH,
            paddingHorizontal: 10,
            paddingVertical: 8,
            justifyContent: 'center',
            backgroundColor: '#FFFFFF',
            borderRightWidth: 1,
            borderRightColor: '#E5E7EB',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Red dot indicator */}
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#EF4444',
                marginRight: 8,
              }}
            />
            <Text
              numberOfLines={2}
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: '600',
                color: '#111827',
                lineHeight: 17,
              }}
            >
              {listing.name}
            </Text>
          </View>
        </View>

        {/* Calendar cells */}
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          <View style={{ flexDirection: 'row', height: '100%' }}>
            {dates.map((date, index) => {
              const entry = getEntryForDate(date);
              const isStart = entry ? isStartOfEntry(date, entry) : false;
              const isEnd = entry ? isEndOfEntry(date, entry) : false;
              const daysFromStart = entry ? getDaysFromStart(date, entry) : 0;
              const hasEntry = !!entry;
              const isBlock = entry?.type === 'block';

              return (
                <Pressable
                  key={index}
                  onPress={() => entry && onEntryPress(entry)}
                  style={{
                    width: DAY_COLUMN_WIDTH,
                    height: '100%',
                    borderRightWidth: 1,
                    borderRightColor: '#E5E7EB',
                    justifyContent: 'center',
                    paddingVertical: 4,
                    // Gray background for empty days (no reservation)
                    backgroundColor: hasEntry ? '#FFFFFF' : '#F3F4F6',
                  }}
                >
                  {entry ? (
                    <View
                      style={{
                        flex: 1,
                        marginHorizontal: isStart ? 2 : 0,
                        marginRight: isEnd ? 2 : 0,
                        backgroundColor: isBlock ? '#E5E7EB' : '#14B8A6',
                        borderTopLeftRadius: isStart ? 6 : 0,
                        borderBottomLeftRadius: isStart ? 6 : 0,
                        borderTopRightRadius: isEnd ? 6 : 0,
                        borderBottomRightRadius: isEnd ? 6 : 0,
                        justifyContent: 'center',
                        paddingHorizontal: 6,
                        overflow: 'hidden',
                      }}
                    >
                      {isBlock ? (
                        // Block indicator with lock icon
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                          <Lock size={14} color="#6B7280" />
                        </View>
                      ) : isStart ? (
                        // Show OTA badge and guest name on first day
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {/* OTA Badge */}
                          <View
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 9,
                              backgroundColor: getOTABadge(entry.channelName).bgColor,
                              justifyContent: 'center',
                              alignItems: 'center',
                              marginRight: 4,
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>
                              {getOTABadge(entry.channelName).letter}
                            </Text>
                          </View>
                          {/* Guest name */}
                          <Text
                            numberOfLines={1}
                            style={{
                              fontSize: 11,
                              fontWeight: '600',
                              color: '#FFFFFF',
                              flex: 1,
                            }}
                          >
                            {entry.guestName}
                          </Text>
                        </View>
                      ) : daysFromStart === 1 && entry.guestCount != null && entry.guestCount > 0 ? (
                        // Show guest count on second day
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 11,
                            fontWeight: '500',
                            color: '#FFFFFF',
                          }}
                        >
                          • {entry.guestCount} guest{entry.guestCount !== 1 ? 's' : ''}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Price row */}
      <View style={{ flexDirection: 'row', height: PRICE_ROW_HEIGHT }}>
        {/* Empty cell under listing name */}
        <View
          style={{
            width: LISTING_COLUMN_WIDTH,
            backgroundColor: '#FFFFFF',
            borderRightWidth: 1,
            borderRightColor: '#E5E7EB',
          }}
        />
        {/* Price cells - not scrollable, synced via state */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          style={{ flex: 1 }}
        >
          {dates.map((date, index) => {
            // Use numeric ID if possible, otherwise hash the string ID
            const numericId = Number(listing.id);
            const safeId = isNaN(numericId) ? Math.abs([...listing.id].reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0)) : numericId;
            const price = getDailyPrice(safeId, date, allEntries);
            // Show base price for empty days (demo purposes), "—" if still NaN
            const fallback = 100 + (safeId % 5) * 50;
            const displayPrice = price || fallback;

            return (
              <View
                key={index}
                style={{
                  width: DAY_COLUMN_WIDTH,
                  height: PRICE_ROW_HEIGHT,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRightWidth: 1,
                  borderRightColor: '#F3F4F6',
                  backgroundColor: '#F9FAFB',
                }}
              >
                <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '500' }}>
                  {isNaN(displayPrice) ? '—' : `${displayPrice}$`}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
});

// Reservation Detail Modal
const ReservationDetail = React.memo(function ReservationDetail({
  entry,
  listing,
  onClose,
}: {
  entry: CalendarEntry;
  listing?: Property;
  onClose: () => void;
}) {
  const nights = differenceInDays(entry.endDate, entry.startDate);
  const otaBadge = getOTABadge(entry.channelName);

  return (
    <Animated.View
      entering={SlideInRight.duration(300)}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: SCREEN_WIDTH * 0.85,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: -4, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB',
          }}
        >
          <Pressable
            onPress={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#F3F4F6',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <X size={18} color="#6B7280" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginLeft: 12 }}>
            {entry.type === 'block' ? 'Block' : 'Reservation'}
          </Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {/* Status Badge */}
          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: entry.type === 'block' ? '#6B7280' : '#14B8A6',
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>
              {entry.status || (entry.type === 'block' ? 'Blocked' : 'Confirmed')}
            </Text>
          </View>

          {/* Guest Info */}
          {entry.type === 'reservation' && (
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {/* OTA Badge */}
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: otaBadge.bgColor,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
                    {otaBadge.letter}
                  </Text>
                </View>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#111827' }}>
                  {entry.guestName || 'Guest'}
                </Text>
              </View>
              {entry.guestCount != null && entry.guestCount > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 44 }}>
                  <Users size={16} color="#6B7280" />
                  <Text style={{ fontSize: 14, color: '#6B7280', marginLeft: 6 }}>
                    {entry.guestCount} guest{entry.guestCount > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Property */}
          {listing && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12,
                backgroundColor: '#F9FAFB',
                borderRadius: 12,
                marginBottom: 16,
              }}
            >
              <Home size={20} color="#14B8A6" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                  {listing.name}
                </Text>
                {listing.address ? (
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                    {listing.address}
                  </Text>
                ) : null}
              </View>
            </View>
          )}

          {/* Dates */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              padding: 16,
              backgroundColor: '#F9FAFB',
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
            <View>
              <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>CHECK-IN</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
                {format(entry.startDate, 'MMM d, yyyy')}
              </Text>
            </View>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 12, color: '#14B8A6', fontWeight: '600' }}>
                {nights} night{nights !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>CHECK-OUT</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
                {format(entry.endDate, 'MMM d, yyyy')}
              </Text>
            </View>
          </View>

          {/* Price */}
          {entry.totalPrice != null && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                backgroundColor: '#F0FDF4',
                borderRadius: 12,
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <DollarSign size={20} color="#16A34A" />
                <Text style={{ fontSize: 14, color: '#16A34A', marginLeft: 8 }}>Total</Text>
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#16A34A' }}>
                {entry.currency || '$'}{entry.totalPrice.toLocaleString()}
              </Text>
            </View>
          )}

          {/* Channel */}
          {entry.channelName && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12,
                backgroundColor: '#F9FAFB',
                borderRadius: 12,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: otaBadge.bgColor,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                  {otaBadge.letter}
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827', marginLeft: 12 }}>
                {entry.channelName}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
});
