import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Catalog, type Campaign, type Named } from '../api';
import { useAuth } from '../auth';
import { ErrorMessage } from '../components/Common';
export function Settings() {
  const { user } = useAuth(); const client = useQueryClient(); const [error, setError] = useState<Error | null>(null); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ kind: 'rubrics' | 'campaigns' | 'tags'; item?: Named | Campaign } | null>(null);
  const query = useQuery({ queryKey: ['catalog'], queryFn: () => api<Catalog>('/catalog') });
  async function remove(kind: string, item: Named) {
    if (!window.confirm(`Удалить «${item.name}»? Используемые записи удалить нельзя.`)) return;
    setBusy(true); setError(null);
    try { await api(`/catalog/${kind}/${item.id}`, 'DELETE'); await client.invalidateQueries({ queryKey: ['catalog'] }); } catch (err) { setError(err as Error); } finally { setBusy(false); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return;
    const data = new FormData(event.currentTarget); const input = Object.fromEntries(data.entries());
    setBusy(true); setError(null);
    try {
      await api(`/catalog/${editing.kind}${editing.item ? `/${editing.item.id}` : ''}`, editing.item ? 'PUT' : 'POST', { ...input, ...(editing.kind === 'campaigns' ? { dateFrom: input.dateFrom ? `${input.dateFrom}T00:00:00Z` : null, dateTo: input.dateTo ? `${input.dateTo}T00:00:00Z` : null } : {}) });
      await client.invalidateQueries({ queryKey: ['catalog'] }); setEditing(null);
    } catch (err) { setError(err as Error); } finally { setBusy(false); }
  }
  return <><header><div><p className="eyebrow">Настройки</p><h1>Справочники и каналы</h1><p>Рубрики, кампании и внутренние метки.</p></div></header><ErrorMessage error={error || query.error}/>
    {query.isPending && <p>Загрузка…</p>}{query.data && <div className="catalog-grid">{(['rubrics','campaigns','tags'] as const).map((kind, index) => <section className="panel" key={kind}><h2>{['Рубрики','Кампании','Теги'][index]}</h2>{query.data![kind].map(item => <div className="catalog-item" key={item.id}><strong>{item.name}</strong>{user.role === 'ADMIN' && <div className="actions"><button disabled={busy} onClick={() => { setError(null); setEditing({ kind, item }); }}>Изменить</button><button className="danger" disabled={busy} onClick={() => void remove(kind, item)}>Удалить</button></div>}</div>)}{!query.data![kind].length && <p className="empty">Записей пока нет.</p>}{user.role === 'ADMIN' && <button onClick={() => { setError(null); setEditing({ kind }); }}>Добавить</button>}</section>)}</div>}
    <section className="panel"><h2>Подключение каналов</h2><p>Интеграции ещё не реализованы. Telegram подключается в Phase 4, затем MAX и VK. OK выключен по умолчанию.</p><div className="channel-list">{['Telegram','MAX','VK','OK'].map(name => <div className="channel" key={name}><strong>{name}</strong><span>{name === 'OK' && !query.data?.features.ok ? 'Выключен' : 'Не подключён'}</span></div>)}</div></section>
    {editing && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Справочник"><h2>{editing.item ? 'Изменить запись' : 'Добавить запись'}</h2><form onSubmit={save} key={editing.item?.id ?? editing.kind}><label>Название<input name="name" required maxLength={200} defaultValue={editing.item?.name}/></label>{editing.kind === 'campaigns' && <><label>Slug<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={(editing.item as Campaign)?.slug}/></label><label>UTM campaign<input name="utmCampaign" required defaultValue={(editing.item as Campaign)?.utmCampaign}/></label><label>Описание<textarea name="description" defaultValue={(editing.item as Campaign)?.description}/></label><div className="two-columns"><label>Начало<input name="dateFrom" type="date" defaultValue={(editing.item as Campaign)?.dateFrom?.slice(0,10)}/></label><label>Конец<input name="dateTo" type="date" defaultValue={(editing.item as Campaign)?.dateTo?.slice(0,10)}/></label></div></>}<ErrorMessage error={error}/><div className="actions"><button type="button" disabled={busy} onClick={() => setEditing(null)}>Отмена</button><button className="primary" disabled={busy}>Сохранить</button></div></form></section></div>}
  </>;
}
