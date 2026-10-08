import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type Catalog, type Post } from '../api';
import { statusLabels, canEdit, type PostStatus } from '../../../shared/contracts';
import { useAuth } from '../auth';
import { ErrorMessage, PostCard } from '../components/Common';
export function Dashboard() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => api<{ counts: Partial<Record<PostStatus, number>>; backlog: number; upcoming: Post[]; todayCount: number; upcomingCount: number }>('/dashboard?timezone=Europe%2FMoscow') });
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => api<Catalog>('/catalog') });
  return <><header><div><p className="eyebrow">Рабочее пространство</p><h1>Обзор контента</h1><p>Планируйте, редактируйте и согласовывайте публикации.</p></div>{canEdit(user.role) && <Link className="button primary" to="/posts/new">+ Новая публикация</Link>}</header>
    <div className="notice">Phase 1: расписание сохраняется в БД. Автопубликация и подключение соцсетей появятся в следующих этапах.</div>
    <ErrorMessage error={query.error}/>{query.isPending && <p>Загрузка…</p>}
    {query.data && <><div className="stats"><Link className="stat" to="/calendar">Сегодня<strong>{query.data.todayCount}</strong></Link><Link className="stat" to="/calendar">Ближайшие 7 дней<strong>{query.data.upcomingCount}</strong></Link>{(['review', 'changes_requested', 'failed', 'partially_published'] as const).map(status => <Link className="stat" to={`/calendar?status=${status}`} key={status}>{statusLabels[status]}<strong>{query.data!.counts[status] ?? 0}</strong></Link>)}<Link className="stat" to="/backlog">Без даты<strong>{query.data.backlog}</strong></Link></div>
    <h2>Ближайшие публикации <small>Europe/Moscow</small></h2><div className="cards">{query.data.upcoming.length ? query.data.upcoming.map(post => <PostCard key={post.id} post={post}/>) : <p className="empty">На ближайшие дни публикаций нет.</p>}</div></>}
    <h2>Каналы</h2><ErrorMessage error={catalog.error}/><div className="channel-list">{['telegram', 'max', 'vk', 'ok'].map(platform => <div className="channel" key={platform}><strong>{platform.toUpperCase()}</strong><span>{platform === 'ok' && !catalog.data?.features.ok ? 'Выключен' : 'Не подключён'}</span></div>)}</div>
  </>;
}
