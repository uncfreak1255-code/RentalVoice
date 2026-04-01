import { useRouter } from 'expo-router';
import { PrivacyPolicyScreen } from '@/components/PrivacyPolicyScreen';

export default function PrivacyPolicyRoute() {
  const router = useRouter();
  return <PrivacyPolicyScreen onBack={() => router.back()} />;
}
