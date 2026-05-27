import { SymbolExplorer, type ExploreInitial } from '../components/SymbolExplorer';
import { useModuleInitial } from '../shell/navigation';

export function ExploreModule() {
  const initial = useModuleInitial<ExploreInitial>('explore');
  return <SymbolExplorer initial={initial ?? undefined} />;
}
