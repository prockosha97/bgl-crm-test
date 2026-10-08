import { Link } from 'react-router-dom';
import { statusLabels } from '../../../shared/contracts';
import type { Post } from '../api';
export function ErrorMessage({ error }: { error: Error | null | undefined }) { return error ? <p role="alert" className="error">{error.message}</p> : null; }
export function PostCard({ post, draggable = false, timezone = post.timezone }: { post: Post; draggable?: boolean; timezone?: string }) {
  return <article className="post-card" draggable={draggable} onDragStart={event => event.dataTransfer.setData('text/plain', post.id)}>
    <Link draggable={false} to={`/posts/${post.id}`}>{post.internalTitle}</Link>
    <span className={`badge ${post.status}`}>{statusLabels[post.status]}</span>
    {post.scheduledAt && <small>{new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(post.scheduledAt))} · {timezone}</small>}
    <small>{post.rubric?.name} {post.platforms.map(p => p.platform.toUpperCase()).join(' · ')}</small>
  </article>;
}
