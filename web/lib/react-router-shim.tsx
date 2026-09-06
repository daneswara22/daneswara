'use client';
// Shim for react-router-dom used inside client-mounted CRA-style pages.
// This forwards routing calls to Next.js App Router primitives.
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import NextLink from 'next/link';
import { useEffect, useMemo, ReactNode, MouseEventHandler, useCallback } from 'react';

export function useNavigate() {
  const router = useRouter();
  return useCallback((to: string, opts?: { replace?: boolean }) => {
    if (opts?.replace) router.replace(to);
    else router.push(to);
  }, [router]);
}

export function useLocation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return {
    pathname,
    search: searchParams?.toString() ? `?${searchParams.toString()}` : '',
    hash: typeof window !== 'undefined' ? window.location.hash : '',
    state: null,
    key: 'default',
  };
}

export function useParams<T = Record<string, string>>(): T {
  // Basic no-op; explicit page params should use Next.js ctx.params instead.
  return {} as T;
}

export function useSearchParamsCompat() {
  return useSearchParams();
}

// react-router-dom compatible: returns [searchParams, setSearchParams] tuple.
// `searchParams` is Next.js ReadonlyURLSearchParams (has .get/.getAll/.has/etc).
export function useSearchParams_rr(): [ReturnType<typeof useSearchParams>, (next: any, opts?: { replace?: boolean }) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const setSearchParams = useCallback((next: any, opts?: { replace?: boolean }) => {
    const usp = new URLSearchParams(
      typeof next === 'function' ? next(new URLSearchParams(params?.toString() || '')) : next,
    );
    const qs = usp.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (opts?.replace) router.replace(url);
    else router.push(url);
  }, [params, router, pathname]);
  return [params, setSearchParams];
}
export { useSearchParams_rr as useSearchParams };

interface NavLinkProps {
  to: string;
  end?: boolean;
  className?: string | ((args: { isActive: boolean }) => string);
  children?: ReactNode | ((args: { isActive: boolean }) => ReactNode);
  onClick?: MouseEventHandler;
  [key: string]: any;
}

export function NavLink({ to, end, className, children, onClick, ...rest }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(to + '/');
  const cls = typeof className === 'function' ? className({ isActive }) : className;
  const kids = typeof children === 'function' ? children({ isActive }) : children;
  return (
    <NextLink data-testid="react-router-shim-next-link-1" href={to} className={cls} onClick={onClick as any} {...rest}>
      {kids}
    </NextLink>
  );
}

export function Link({ to, children, className, onClick, ...rest }: any) {
  return (
    <NextLink data-testid="react-router-shim-next-link-2" href={to} className={className} onClick={onClick} {...rest}>
      {children}
    </NextLink>
  );
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [to, replace, router]);
  return null;
}

// Outlet: rendered content is provided by Next.js as `children` in layouts.
// The Next.js layout wraps its <Layout /> in <OutletProvider value={children}> so <Outlet /> can render them.
import { createContext, useContext } from 'react';
const OutletCtx = createContext<ReactNode>(null);
export function OutletProvider({ children, value }: { children: ReactNode; value: ReactNode }) {
  return <OutletCtx.Provider value={value}>{children}</OutletCtx.Provider>;
}
export function Outlet() {
  return <>{useContext(OutletCtx)}</>;
}

// Convenience placeholder exports so `import { BrowserRouter, Routes, Route } from 'react-router-dom'` doesn't crash.
export function BrowserRouter({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function Routes({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function Route(_props: any): any {
  return null;
}
