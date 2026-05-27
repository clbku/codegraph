import type { ComponentType, ReactNode } from 'react';
import { ExploreModule } from '../modules/ExploreModule';
import { TraceModule } from '../modules/TraceModule';
import { ComingSoonModule } from '../modules/ComingSoonModule';
import {
  IconSearch, IconFlow, IconFiles, IconStats, IconRoute, IconSettings,
} from './icons';

export interface ModuleDef {
  id: string;
  title: string;
  /** Short description shown in tooltips / module header. */
  subtitle: string;
  icon: ReactNode;
  component: ComponentType;
  /** When true the module is registered but greyed out in the activity bar. */
  disabled?: boolean;
}

// Adding a new module: register it here. The shell handles everything else
// (icon button, routing via active id, header, body). No other file changes.
export const MODULES: ModuleDef[] = [
  {
    id: 'explore',
    title: 'Explore',
    subtitle: 'Search symbols and drill into callers / callees',
    icon: <IconSearch />,
    component: ExploreModule,
  },
  {
    id: 'trace',
    title: 'Trace',
    subtitle: 'Visualise the call path between two symbols',
    icon: <IconFlow />,
    component: TraceModule,
  },
  {
    id: 'files',
    title: 'Files',
    subtitle: 'Browse the project tree and per-file symbols',
    icon: <IconFiles />,
    component: () => <ComingSoonModule name="File browser" hint="Browse the project tree, jump into a file and see all symbols defined there." />,
    disabled: true,
  },
  {
    id: 'stats',
    title: 'Stats',
    subtitle: 'Index health, language mix and edge breakdown',
    icon: <IconStats />,
    component: () => <ComingSoonModule name="Stats dashboard" hint="Charts for node / edge breakdown, language mix, synthesized edge precision and index size over time." />,
    disabled: true,
  },
  {
    id: 'routes',
    title: 'Routes',
    subtitle: 'HTTP routes detected from frameworks',
    icon: <IconRoute />,
    component: () => <ComingSoonModule name="Routes" hint="Detected HTTP routes (Express, Laravel, Rails, FastAPI…) with one-click trace into the handler chain." />,
    disabled: true,
  },
];

export const SETTINGS_MODULE: ModuleDef = {
  id: 'settings',
  title: 'Settings',
  subtitle: 'UI preferences and connection info',
  icon: <IconSettings />,
  component: () => <ComingSoonModule name="Settings" hint="Theme, font size, port, default module — preferences will live here." />,
  disabled: true,
};
