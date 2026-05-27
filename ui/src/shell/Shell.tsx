import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { StatsResponse } from '../api/types';
import { MODULES, SETTINGS_MODULE, type ModuleDef } from './modules';
import { IconLogo } from './icons';
import { NavigationProvider } from './navigation';

const ACTIVE_STORAGE_KEY = 'codegraph-ui:active-module';

export function Shell() {
  const allModules = useMemo(() => [...MODULES, SETTINGS_MODULE], []);
  const [activeId, setActiveId] = useState<string>(() => {
    const stored = localStorage.getItem(ACTIVE_STORAGE_KEY);
    if (stored && MODULES.some((m) => m.id === stored && !m.disabled)) return stored;
    return MODULES.find((m) => !m.disabled)?.id ?? MODULES[0]!.id;
  });

  useEffect(() => {
    localStorage.setItem(ACTIVE_STORAGE_KEY, activeId);
  }, [activeId]);

  const active = allModules.find((m) => m.id === activeId) ?? MODULES[0]!;
  const ActiveComponent = active.component;

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.stats()
      .then((s) => { if (!cancelled) setStats(s); })
      .catch((e) => { if (!cancelled) setStatsError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const handleNavigate = useCallback((id: string) => {
    if (!MODULES.some((m) => m.id === id && !m.disabled) && id !== SETTINGS_MODULE.id) return;
    setActiveId(id);
  }, []);

  return (
    <NavigationProvider onNavigate={handleNavigate}>
      <div className="shell">
        <ActivityBar
          modules={MODULES}
          settings={SETTINGS_MODULE}
          activeId={activeId}
          onSelect={setActiveId}
        />
        <div className="shell-main">
          <ModuleHeader module={active} />
          <div className="module-body">
            <ActiveComponent />
          </div>
          <StatusBar stats={stats} error={statsError} />
        </div>
      </div>
    </NavigationProvider>
  );
}

function ActivityBar({
  modules,
  settings,
  activeId,
  onSelect,
}: {
  modules: ModuleDef[];
  settings: ModuleDef;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="activity-bar">
      <div className="activity-logo" title="CodeGraph">
        <IconLogo size={22} />
      </div>
      <nav className="activity-list">
        {modules.map((m) => (
          <ActivityButton key={m.id} module={m} active={m.id === activeId} onSelect={onSelect} />
        ))}
      </nav>
      <div className="activity-spacer" />
      <nav className="activity-list">
        <ActivityButton module={settings} active={activeId === settings.id} onSelect={onSelect} />
      </nav>
    </aside>
  );
}

function ActivityButton({
  module,
  active,
  onSelect,
}: {
  module: ModuleDef;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={`activity-button ${active ? 'active' : ''} ${module.disabled ? 'disabled' : ''}`}
      title={`${module.title}${module.disabled ? ' — coming soon' : ''}`}
      aria-label={module.title}
      aria-disabled={module.disabled}
      onClick={() => onSelect(module.id)}
    >
      {module.icon}
    </button>
  );
}

function ModuleHeader({ module }: { module: ModuleDef }) {
  return (
    <header className="module-header">
      <div className="module-header-icon">{module.icon}</div>
      <div className="module-header-text">
        <div className="module-header-title">{module.title}</div>
        <div className="module-header-subtitle">{module.subtitle}</div>
      </div>
    </header>
  );
}

function StatusBar({ stats, error }: { stats: StatsResponse | null; error: string | null }) {
  const parts: Array<{ key: string; label: string; tone?: 'warn' | 'ok' }> = [];
  if (error) {
    parts.push({ key: 'err', label: error, tone: 'warn' });
  } else if (stats) {
    parts.push({ key: 'root', label: shortenPath(stats.projectRoot) });
    parts.push({ key: 'files', label: `${stats.totalFiles.toLocaleString()} files` });
    parts.push({ key: 'nodes', label: `${stats.totalNodes.toLocaleString()} symbols` });
    parts.push({ key: 'edges', label: `${stats.totalEdges.toLocaleString()} edges` });
    if (stats.synthesizedEdges > 0) {
      parts.push({ key: 'synth', label: `${stats.synthesizedEdges} synthesized`, tone: 'ok' });
    }
    parts.push({ key: 'backend', label: stats.backend });
  } else {
    parts.push({ key: 'load', label: 'Loading…' });
  }
  return (
    <footer className="status-bar">
      {parts.map((p, i) => (
        <span key={p.key} className={`status-item ${p.tone ?? ''}`}>
          {i > 0 && <span className="status-sep">·</span>}
          {p.label}
        </span>
      ))}
    </footer>
  );
}

function shortenPath(p: string): string {
  const home = '/Users/';
  if (!p.startsWith(home)) return p;
  const rest = p.slice(home.length);
  const slash = rest.indexOf('/');
  if (slash < 0) return p;
  return '~' + rest.slice(slash);
}
