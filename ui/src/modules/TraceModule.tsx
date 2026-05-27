import { TraceView, type TraceInitial } from '../components/TraceView';
import { useModuleInitial } from '../shell/navigation';

export function TraceModule() {
  const initial = useModuleInitial<TraceInitial>('trace');
  return <TraceView initial={initial ?? undefined} />;
}
