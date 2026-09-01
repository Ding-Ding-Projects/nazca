export function publicPath(pathname: string) {
  const prefix = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  if (!prefix) return pathname;
  if (pathname === '/') return `${prefix}/`;
  return `${prefix}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}
