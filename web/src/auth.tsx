import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, setCsrf, type User } from './api';
const AuthContext = createContext<{ user: User; logout: () => Promise<void> } | null>(null);
export function useAuth() { return useContext(AuthContext)!; }
export function AuthProvider({ children, login }: { children: ReactNode; login: ReactNode }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['session'], queryFn: async () => { try { const session = await api<{ user: User; csrfToken: string }>('/auth/me'); setCsrf(session.csrfToken); return session.user; } catch (err) { if (err instanceof ApiError && err.status === 401) { setCsrf(''); return null; } throw err; } }, retry: false, refetchInterval: 60000 });
  if (query.isPending) return <main className="center">Загрузка…</main>;
  if (query.isError) return <main className="center"><p role="alert">{query.error.message}</p><button onClick={() => void query.refetch()}>Повторить</button></main>;
  if (!query.data) return login;
  const logout = async () => { await api('/auth/logout', 'POST'); setCsrf(''); client.clear(); await client.invalidateQueries({ queryKey: ['session'] }); };
  return <AuthContext.Provider value={{ user: query.data, logout }}>{children}</AuthContext.Provider>;
}
