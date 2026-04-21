import { useLocalSearchParams } from 'expo-router';

import { CreateMomentScreen } from '@/components/CreateMomentScreen';

export default function EditMomentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const n = id ? Number.parseInt(id, 10) : Number.NaN;
  const editId = Number.isFinite(n) && n > 0 ? n : null;
  return <CreateMomentScreen editId={editId} />;
}
