import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// Cross-module navigation. Routes → Explore wants to pre-select a handler;
// Routes → Trace wants the `from` field pre-filled. The registry's
// `component: ComponentType` is prop-less, so payload is delivered through
// context and consumed by the destination module on mount.
//
// Implementation note: a previous version stored payloads in a Map and
// removed them on first read. Under React.StrictMode (dev), every component
// double-mounts, so the first mount consumed the payload and the second
// mount got nothing → the module rendered as if no payload was passed.
// We use a token-per-navigation pattern instead: payload lives in state
// until overwritten by the next navigate(), and each consumer remembers
// the last token it has processed via a useRef — idempotent under
// StrictMode's double-invoke.

export interface NavigationRequest {
  to: string;
  payload?: unknown;
}

interface NavigationState {
  to: string;
  payload: unknown;
  token: number;
}

interface NavigationContextValue {
  current: NavigationState | null;
  navigate(request: NavigationRequest): void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({
  onNavigate,
  children,
}: {
  onNavigate: (id: string) => void;
  children: ReactNode;
}) {
  const [current, setCurrent] = useState<NavigationState | null>(null);
  const tokenRef = useRef(0);

  const navigate = useCallback((req: NavigationRequest) => {
    tokenRef.current += 1;
    setCurrent({ to: req.to, payload: req.payload, token: tokenRef.current });
    onNavigate(req.to);
  }, [onNavigate]);

  const value = useMemo<NavigationContextValue>(() => ({ current, navigate }), [current, navigate]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used inside NavigationProvider');
  return ctx;
}

// Return the navigation payload addressed to `moduleId`, exactly once per
// distinct navigate() call. Safe under StrictMode's double-mount because the
// gate is per-token (not "did I read it yet"), so both instances of the
// double-mounted component get the same payload back.
export function useModuleInitial<T = unknown>(moduleId: string): T | null {
  const { current } = useNavigation();
  const consumedTokenRef = useRef<number>(-1);

  if (!current || current.to !== moduleId) return null;
  if (current.token === consumedTokenRef.current) return null;
  consumedTokenRef.current = current.token;
  return (current.payload ?? null) as T | null;
}
