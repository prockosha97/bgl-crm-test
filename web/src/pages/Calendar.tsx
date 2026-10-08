import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, postToInput, type Catalog, type Named, type Post } from '../api';
import { canEdit, statusLabels, statuses } from '../../../shared/contracts';
import { localToUtc, shiftDay, zonedDay, zonedInput } from '../../../shared/time';
import { useAuth } from '../auth';
import { ErrorMessage, PostCard } from '../components/Common';
export function Calendar({ backlog = false }: { backlog?: boolean }) {
  const { user } = useAuth(); const client = useQueryClient(); const [params] = useSearchParams();
  const [mode, setMode] = useState('month'); const [day, setDay] = useState(zonedDay(new Date(), 'Europe/Moscow')); const [timezone, setTimezone] = useState('Europe/Moscow');
  const [filters, setFilters] = useState({ status: params.get('status') ?? '', platform: '', rubricId: '', campaignId: '', authorId: '', search: '' });
  const [offset, setOffset] = useState(0); const [move, setMove] = useState<{ post: Post; scheduledAt: string } | null>(null); const [dropError, setDropError] = useState<Error | null>(null);
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => api<Catalog>('/catalog') });
  const authors = useQuery({ queryKey: ['authors'], queryFn: () => api<Named[]>('/users/options') });
  const first = mode === 'week' ? shiftDay(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7)) : `${day.slice(0, 7)}-01`;
  const last = mode === 'week' ? shiftDay(first, 7) : new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const queryParams = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  queryParams.set('offset', String(offset)); queryParams.set('limit', '200');
  if (backlog) queryParams.set('backlog', 'true'); else { queryParams.set('from', localToUtc(`${first}T00:00`, timezone)); queryParams.set('to', localToUtc(`${last}T00:00`, timezone)); }
  const query = useQuery({ queryKey: ['posts', backlog, queryParams.toString()], queryFn: () => api<{ items: Post[]; total: number }>(`/posts?${queryParams}`) });
  const unscheduled = useQuery({ queryKey: ['posts', 'calendar-backlog'], queryFn: () => api<{ items: Post[]; total: number }>('/posts?backlog=true&limit=20'), enabled: !backlog && canEdit(user.role) });
  const mutation = useMutation({ mutationFn: async () => { if (!move) return; return api<Post>(`/posts/${move.post.id}`, 'PUT', { ...postToInput(move.post), version: move.post.version, scheduledAt: move.scheduledAt, timezone }); }, onSuccess: async () => { setMove(null); await client.invalidateQueries({ queryKey: ['posts'] }); await client.invalidateQueries({ queryKey: ['dashboard'] }); } });
  const days: string[] = [];
  const gridFirst = mode === 'month' ? shiftDay(first, -((new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7)) : first;
  const count = mode === 'month' ? Math.ceil((Math.round((Date.parse(`${last}T12:00:00Z`) - Date.parse(`${gridFirst}T12:00:00Z`)) / 86400000)) / 7) * 7 : 7;
  for (let i = 0; i < count; i++) days.push(shiftDay(gridFirst, i));
  async function drop(event: React.DragEvent, targetDay: string) {
    event.preventDefault(); if (!canEdit(user.role)) return;
    try {
      const id = event.dataTransfer.getData('text/plain'); if (!/^[a-f\d-]{36}$/.test(id)) return;
      const post = await api<Post>(`/posts/${id}`);
      if (!['idea', 'draft', 'changes_requested', 'approved', 'scheduled'].includes(post.status)) throw new Error('Сначала верните публикацию в черновик');
      const time = post.scheduledAt ? zonedInput(post.scheduledAt, timezone).slice(11) : '12:00';
      mutation.reset(); setDropError(null); setMove({ post, scheduledAt: localToUtc(`${targetDay}T${time}`, timezone) });
    } catch (error) { setDropError(error as Error); }
  }
  function shiftPeriod(delta: number) { setOffset(0); setDay(mode === 'week' ? shiftDay(day, delta * 7) : new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1 + delta, 1)).toISOString().slice(0, 10)); }
  function filter(name: keyof typeof filters, value: string) { setOffset(0); setFilters({ ...filters, [name]: value }); }
  return <><header><div><p className="eyebrow">Контент-план</p><h1>{backlog ? 'Бэклог' : 'Календарь'}</h1><p>{backlog ? 'Идеи и публикации без назначенной даты' : `Расписание в часовом поясе ${timezone}`}</p></div>{canEdit(user.role) && <Link className="button primary" to="/posts/new">+ Новая публикация</Link>}</header>
    {!backlog && <div className="toolbar"><button aria-label="Предыдущий период" onClick={() => shiftPeriod(-1)}>←</button><label>Период<input type="date" value={day} onChange={e => { setDay(e.target.value || zonedDay(new Date(), timezone)); setOffset(0); }}/></label><button aria-label="Следующий период" onClick={() => shiftPeriod(1)}>→</button><label>Режим<select value={mode} onChange={e => { setMode(e.target.value); setOffset(0); }}><option value="month">Месяц</option><option value="week">Неделя</option><option value="list">Список</option></select></label><label>Часовой пояс<select value={timezone} onChange={e => setTimezone(e.target.value)}>{['Europe/Moscow','UTC','Europe/Berlin','Asia/Yekaterinburg','Asia/Novosibirsk','Asia/Vladivostok'].map(t => <option key={t}>{t}</option>)}</select></label></div>}
    <div className="filters"><label>Название<input value={filters.search} onChange={e => filter('search', e.target.value)}/></label><label>Статус<select value={filters.status} onChange={e => filter('status', e.target.value)}><option value="">Все</option>{statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label><label>Площадка<select value={filters.platform} onChange={e => filter('platform', e.target.value)}><option value="">Все</option>{['telegram','max','vk','ok'].map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}</select></label>{(['rubricId','campaignId','authorId'] as const).map((name, i) => <label key={name}>{['Рубрика','Кампания','Автор'][i]}<select value={filters[name]} onChange={e => filter(name, e.target.value)}><option value="">Все</option>{(i === 0 ? catalog.data?.rubrics : i === 1 ? catalog.data?.campaigns : authors.data)?.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>)}</div>
    <ErrorMessage error={query.error || dropError || catalog.error || authors.error}/>{query.isPending && <p>Загрузка…</p>}
    {query.data && (backlog || mode === 'list' ? <div className="cards">{query.data.items.length ? query.data.items.map(post => <PostCard key={post.id} post={post}/>) : <p className="empty">Публикаций не найдено.</p>}</div> : <div className="calendar-layout"><div className="calendar-scroll"><div className="calendar-grid">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => <strong className="weekday" key={d}>{d}</strong>)}{days.map(d => <section key={d} className={`day ${d.slice(0,7) !== first.slice(0,7) && mode === 'month' ? 'outside' : ''}`} aria-label={d} onDragOver={e => e.preventDefault()} onDrop={e => void drop(e, d)}><span className={d === zonedDay(new Date(), timezone) ? 'today' : ''}>{Number(d.slice(8))}{mode === 'week' ? `.${d.slice(5,7)}` : ''}</span>{query.data!.items.filter(p => p.scheduledAt && zonedDay(p.scheduledAt, timezone) === d).map(p => <PostCard post={p} key={p.id} timezone={timezone} draggable={canEdit(user.role) && ['idea','draft','approved','scheduled','changes_requested'].includes(p.status)}/>)}</section>)}</div></div>{canEdit(user.role) && <aside className="calendar-backlog"><h2>Без даты</h2><small>Перетащите карточку на день календаря</small><ErrorMessage error={unscheduled.error}/><div className="backlog-cards">{unscheduled.data?.items.filter(p => ['idea','draft','changes_requested'].includes(p.status)).map(p => <PostCard post={p} key={p.id} draggable/>)}{unscheduled.data && !unscheduled.data.items.length && <p className="empty">Бэклог пуст.</p>}</div><Link to="/backlog">Весь бэклог →</Link></aside>}</div>)}
    {query.data && <div className="toolbar"><small>Показано {query.data.items.length} из {query.data.total}</small>{query.data.total > 200 && <><button disabled={!offset} onClick={() => setOffset(offset - 200)}>Назад</button><button disabled={offset + 200 >= query.data.total} onClick={() => setOffset(offset + 200)}>Далее</button></>}</div>}
    {move && <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="move-title" className="modal"><h2 id="move-title">Перенести публикацию</h2><p>{move.post.internalTitle}</p><p>Старая дата: {move.post.scheduledAt ? zonedInput(move.post.scheduledAt, timezone).replace('T',' ') : 'Без даты'}</p><p>Новая дата: {zonedInput(move.scheduledAt, timezone).replace('T',' ')} ({timezone})</p>{['approved','scheduled'].includes(move.post.status) && <p className="notice">Согласование будет сброшено. Публикация вернётся в черновик.</p>}<ErrorMessage error={mutation.error}/><div className="actions"><button disabled={mutation.isPending} onClick={() => setMove(null)}>Отмена</button><button className="primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>Перенести</button></div></section></div>}
  </>;
}
