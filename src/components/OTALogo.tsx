import React from 'react';
import { View, Text } from 'react-native';
import { Svg, Path, Circle, G, Rect } from 'react-native-svg';

interface OTALogoProps {
  platform: 'airbnb' | 'booking' | 'vrbo' | 'direct';
  size?: number;
}

// Airbnb logo - simplified "A" shape
function AirbnbLogo({ size }: { size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FF5A5F',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
        <Path
          d="M12 0C8.5 5.5 5.5 8.5 5.5 12c0 3.5 2.5 6 6.5 6s6.5-2.5 6.5-6c0-3.5-3-6.5-6.5-12zm0 16c-2.5 0-4.5-1.5-4.5-4 0-2 2-4.5 4.5-8.5 2.5 4 4.5 6.5 4.5 8.5 0 2.5-2 4-4.5 4z"
          fill="#FFFFFF"
        />
      </Svg>
    </View>
  );
}

// Booking.com logo - "B" in dark blue
function BookingLogo({ size }: { size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#003580',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: size * 0.55,
          fontWeight: '800',
        }}
      >
        B
      </Text>
    </View>
  );
}

// VRBO logo - "V" in Vrbo blue
function VrboLogo({ size }: { size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#0050F0', // Official Vrbo blue
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: size * 0.5,
          fontWeight: '800',
        }}
      >
        V
      </Text>
    </View>
  );
}

// Direct booking logo - "D" in teal
function DirectLogo({ size }: { size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#14B8A6',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: size * 0.5,
          fontWeight: '800',
        }}
      >
        D
      </Text>
    </View>
  );
}

export function OTALogo({ platform, size = 24 }: OTALogoProps) {
  switch (platform) {
    case 'airbnb':
      return <AirbnbLogo size={size} />;
    case 'booking':
      return <BookingLogo size={size} />;
    case 'vrbo':
      return <VrboLogo size={size} />;
    case 'direct':
    default:
      return <DirectLogo size={size} />;
  }
}

// Platform label component for larger displays
export function OTAPlatformLabel({ platform }: { platform: 'airbnb' | 'booking' | 'vrbo' | 'direct' }) {
  const labels: Record<string, { name: string; color: string }> = {
    airbnb: { name: 'Airbnb', color: '#FF5A5F' },
    booking: { name: 'Booking.com', color: '#003580' },
    vrbo: { name: 'Vrbo', color: '#0050F0' }, // Official Vrbo blue
    direct: { name: 'Direct', color: '#14B8A6' },
  };

  const { name, color } = labels[platform] || labels.direct;

  return (
    <View
      style={{
        backgroundColor: `${color}20`,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <OTALogo platform={platform} size={14} />
      <Text
        style={{
          color: color,
          fontSize: 11,
          fontWeight: '600',
          marginLeft: 4,
        }}
      >
        {name}
      </Text>
    </View>
  );
}
