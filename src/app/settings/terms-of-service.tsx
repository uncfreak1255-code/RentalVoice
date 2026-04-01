import { useRouter } from 'expo-router';
import { TermsOfServiceScreen } from '@/components/TermsOfServiceScreen';

export default function TermsOfServiceRoute() {
  const router = useRouter();
  return <TermsOfServiceScreen onBack={() => router.back()} />;
}
