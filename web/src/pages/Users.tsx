import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type User } from '../api';
import { roles } from '../../../shared/contracts';
import { ErrorMessage } from '../components/Common';
export function Users() {
  const client = useQueryClient(); const [error, setError] = useState<Error | null>(null); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<User | 'new' | null>(null); const [reset, setReset] = useState<User | null>(null);
  const query = useQuery({ queryKey: ['users'], queryFn: () => api<User[]>('/users') });
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setBusy(true); setError(null);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await api(editing === 'new' ? '/users' : `/users/${editing.id}`, editing === 'new' ? 'POST' : 'PUT', { ...data, ...(editing === 'new' ? {} : { isActive: data.isActive === 'on' }) });
      setEditing(null); await client.invalidateQueries({ queryKey: ['users'] }); await client.invalidateQueries({ queryKey: ['session'] }); await client.invalidateQueries({ queryKey: ['authors'] });
    } catch (err) { setError(err as Error); } finally { setBusy(false); }
  }
  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!reset) return; const data = Object.fromEntries(new FormData(event.currentTarget).entries()); setBusy(true); setError(null);
    try { await api(`/users/${reset.id}/password`, 'POST', data); setReset(null); await client.invalidateQueries({ queryKey: ['session'] }); } catch (err) { setError(err as Error); } finally { setBusy(false); }
  }
  return <><header><div><p className="eyebrow">Администрирование</p><h1>Пользователи</h1><p>Закрытая команда. Публичной регистрации нет.</p></div><button className="primary" onClick={() => { setError(null); setEditing('new'); }}>+ Добавить пользователя</button></header><ErrorMessage error={error || query.error}/>
    {query.isPending && <p>Загрузка…</p>}<div className="table-scroll"><table><thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Статус</th><th>Действия</th></tr></thead><tbody>{query.data?.map(user => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td><td>{user.isActive ? 'Активен' : 'Отключён'}</td><td><div className="actions"><button onClick={() => { setError(null); setEditing(user); }}>Изменить</button><button onClick={() => { setError(null); setReset(user); }}>Сброс пароля</button></div></td></tr>)}</tbody></table></div>
    {editing && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Пользователь"><h2>{editing === 'new' ? 'Новый пользователь' : 'Изменить пользователя'}</h2><form onSubmit={save} key={editing === 'new' ? 'new' : editing.id}><label>Имя<input name="name" required maxLength={120} defaultValue={editing === 'new' ? '' : editing.name}/></label>{editing === 'new' && <><label>Email<input name="email" type="email" required/></label><label>Пароль<input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password"/></label></>}<label>Роль<select name="role" defaultValue={editing === 'new' ? 'VIEWER' : editing.role}>{roles.map(r => <option key={r}>{r}</option>)}</select></label>{editing !== 'new' && <label className="check"><input type="checkbox" name="isActive" defaultChecked={editing.isActive}/>Активен</label>}<ErrorMessage error={error}/><div className="actions"><button type="button" disabled={busy} onClick={() => setEditing(null)}>Отмена</button><button className="primary" disabled={busy}>Сохранить</button></div></form></section></div>}
    {reset && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Сброс пароля"><h2>Сброс пароля: {reset.name}</h2><p>Все сессии пользователя будут завершены.</p><form onSubmit={resetPassword}><label>Новый пароль<input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password"/></label><ErrorMessage error={error}/><div className="actions"><button type="button" disabled={busy} onClick={() => setReset(null)}>Отмена</button><button className="primary" disabled={busy}>Сбросить пароль</button></div></form></section></div>}
  </>;
}
