import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, postToInput, type Catalog, type Post } from '../api';
import { canEdit, effectiveText, platformLabels, platforms, postInputSchema, statusLabels, type PostInput, type PostAction } from '../../../shared/contracts';
import { localToUtc, zonedInput } from '../../../shared/time';
import { useAuth } from '../auth';
import { ErrorMessage } from '../components/Common';
const blank: PostInput = { internalTitle: '', baseText: '', ctaUrl: null, scheduledAt: null, timezone: 'Europe/Moscow', rubricId: null, campaignId: null, tagIds: [], platforms: [], variants: [], contentEntityType: null, contentEntityId: null, contentEntityUrl: null };
export function PostEditor() {
  const { id } = useParams(); const query = useQuery({ queryKey: ['post', id], queryFn: () => api<Post>(`/posts/${id}`), enabled: !!id });
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => api<Catalog>('/catalog') });
  if (query.isError || catalog.isError) return <ErrorMessage error={query.error || catalog.error}/>;
  if ((id && query.isPending) || catalog.isPending) return <p>Загрузка…</p>;
  if (!catalog.data) return null;
  return <EditorForm key={`${id ?? 'new'}-${query.data?.version ?? 0}`} post={query.data} catalog={catalog.data}/>;
}
function EditorForm({ post, catalog }: { post?: Post; catalog: Catalog }) {
  const { user } = useAuth(); const client = useQueryClient(); const navigate = useNavigate();
  const [error, setError] = useState<Error | null>(null); const [busy, setBusy] = useState(false); const [comment, setComment] = useState(''); const [tab, setTab] = useState<PostInput['platforms'][number]>('telegram');
  const [initialStatus, setInitialStatus] = useState('draft');
  const [localDate, setLocalDate] = useState(post?.scheduledAt ? zonedInput(post.scheduledAt, post.timezone) : '');
  const editable = canEdit(user.role) && (!post || ['idea','draft','changes_requested','approved','scheduled'].includes(post.status));
  const { register, handleSubmit, watch, setValue, formState: { isDirty, errors } } = useForm<PostInput>({ resolver: zodResolver(postInputSchema) as Resolver<PostInput>, defaultValues: post ? postToInput(post) : blank });
  const values = watch();
  const dateDirty = localDate !== (post?.scheduledAt ? zonedInput(post.scheduledAt, post.timezone) : '');
  const dirty = isDirty || dateDirty;
  async function refresh(result: Post) { client.setQueryData(['post', result.id], result); await client.invalidateQueries({ queryKey: ['posts'] }); await client.invalidateQueries({ queryKey: ['dashboard'] }); navigate(`/posts/${result.id}`, { replace: !post }); }
  async function save(input: PostInput) {
    setBusy(true); setError(null);
    try {
      const scheduledAt = localDate ? localToUtc(localDate, input.timezone) : null;
      const result = await api<Post>(post ? `/posts/${post.id}` : '/posts', post ? 'PUT' : 'POST', { ...input, scheduledAt, ...(post ? { version: post.version } : { status: initialStatus }) });
      await refresh(result);
    } catch (error) { setError(error as Error); } finally { setBusy(false); }
  }
  async function action(action: PostAction) {
    if (!post) return; setBusy(true); setError(null);
    try { await refresh(await api<Post>(`/posts/${post.id}/actions`, 'POST', { action, version: post.version, comment })); } catch (error) { setError(error as Error); } finally { setBusy(false); }
  }
  function toggle(platform: PostInput['platforms'][number], checked: boolean) {
    setValue('platforms', checked ? [...values.platforms, platform] : values.platforms.filter(p => p !== platform), { shouldDirty: true });
    setValue('variants', checked ? [...values.variants, { platform, inheritBaseText: true, text: '' }] : values.variants.filter(v => v.platform !== platform), { shouldDirty: true });
  }
  const previewVariant = values.variants.find(v => v.platform === tab);
  return <><header><div><p className="eyebrow">{post ? statusLabels[post.status] : 'Новая публикация'}</p><h1>{post ? post.internalTitle : 'Редактор публикации'}</h1></div>{post && <span className={`badge ${post.status}`}>{statusLabels[post.status]} · v{post.version}</span>}</header>
    <ErrorMessage error={error}/>{post && ['approved','scheduled'].includes(post.status) && editable && <p className="notice">Любое сохранение изменённой публикации сбросит согласование и вернёт её в черновик.</p>}
    <div className="editor-layout"><form onSubmit={handleSubmit(save)}><fieldset disabled={!editable || busy} className="panel">
      <label>Внутреннее название<input {...register('internalTitle')}/></label>{errors.internalTitle && <p className="error">{errors.internalTitle.message}</p>}
      {!post && <label>Создать как<select value={initialStatus} onChange={e => setInitialStatus(e.target.value)}><option value="draft">Черновик</option><option value="idea">Идея</option></select></label>}
      <div className="two-columns"><label>Рубрика<select {...register('rubricId', { setValueAs: v => v || null })}><option value="">Без рубрики</option>{catalog.rubrics.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Кампания<select {...register('campaignId', { setValueAs: v => v || null })}><option value="">Без кампании</option>{catalog.campaigns.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
      <label>Теги<select multiple value={values.tagIds} onChange={e => setValue('tagIds', Array.from(e.target.selectedOptions).map(o => o.value), { shouldDirty: true })}>{catalog.tags.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Базовый текст<textarea rows={8} {...register('baseText')}/></label>
      <label>CTA URL<input type="url" placeholder="https://…" {...register('ctaUrl')}/></label>
      <div className="two-columns"><label>Дата и время<input type="datetime-local" value={localDate} onChange={e => setLocalDate(e.target.value)}/></label><label>Часовой пояс<input {...register('timezone')} list="timezones"/><datalist id="timezones">{['Europe/Moscow','UTC','Europe/Berlin','Asia/Yekaterinburg','Asia/Novosibirsk','Asia/Vladivostok'].map(t => <option key={t} value={t}/>)}</datalist></label></div>{errors.timezone && <p className="error">{errors.timezone.message}</p>}
      <h2>Площадки</h2><div className="checks">{platforms.map(platform => <label className="check" key={platform}><input type="checkbox" checked={values.platforms.includes(platform)} disabled={platform === 'ok' && !catalog.features.ok} onChange={e => toggle(platform, e.target.checked)}/>{platformLabels[platform]}{platform === 'ok' && !catalog.features.ok ? ' (выключен)' : ''}</label>)}</div>
      {values.variants.map((variant, index) => <section className="variant" key={variant.platform}><h3>{platformLabels[variant.platform]}</h3><label className="check"><input type="checkbox" {...register(`variants.${index}.inheritBaseText`)}/>Наследовать базовый текст</label>{!variant.inheritBaseText && <label>Текст {platformLabels[variant.platform]}<textarea rows={5} {...register(`variants.${index}.text`)}/></label>}</section>)}
      <details><summary>Связь с материалом БГЛ</summary><label>Тип материала<select {...register('contentEntityType', { setValueAs: v => v || null })}><option value="">Не указан</option>{['lecture','collection','campaign_page','news','other'].map(t => <option key={t}>{t}</option>)}</select></label><label>ID материала<input {...register('contentEntityId', { setValueAs: v => v || null })}/></label><label>URL материала<input type="url" {...register('contentEntityUrl')}/></label></details>
      {editable && <button className="primary" disabled={busy || (!!post && !dirty)}>{busy ? 'Сохранение…' : 'Сохранить'}</button>}
    </fieldset></form>
    <aside><section className="panel"><h2>Предпросмотр</h2><div className="tabs">{platforms.map(p => <button key={p} className={tab === p ? 'active' : ''} onClick={() => setTab(p)}>{platformLabels[p]}</button>)}</div><small>Приблизительное отображение, без обещания точного соответствия соцсети.</small>{previewVariant ? <div className="preview"><strong>Библиотека готовых лекций</strong><p>{effectiveText(values.baseText, previewVariant) || 'Текст ещё не заполнен'}</p>{values.ctaUrl && <p>{values.ctaUrl}</p>}</div> : <p className="empty">Выберите эту площадку для публикации.</p>}</section>
      {post && <section className="panel"><h2>Действия</h2>{dirty && <p className="notice">Сохраните изменения перед сменой статуса.</p>}<div className="action-stack">
        {canEdit(user.role) && ['idea','changes_requested','review'].includes(post.status) && <button disabled={busy || dirty} onClick={() => void action('draft')}>Вернуть в черновик</button>}
        {canEdit(user.role) && ['draft','changes_requested'].includes(post.status) && <button disabled={busy || dirty} onClick={() => void action('submit')}>На согласование</button>}
        {['ADMIN','APPROVER'].includes(user.role) && post.status === 'review' && <><label>Комментарий к решению<textarea value={comment} onChange={e => setComment(e.target.value)}/></label><button className="primary" disabled={busy || dirty} onClick={() => void action('approve')}>Согласовать</button><button disabled={busy || dirty} onClick={() => void action('reject')}>На доработку</button></>}
        {canEdit(user.role) && post.status === 'approved' && <button className="primary" disabled={busy || dirty} onClick={() => void action('schedule')}>Запланировать</button>}
        {canEdit(user.role) && ['idea','draft','review','changes_requested','approved','scheduled'].includes(post.status) && <button className="danger" disabled={busy || dirty} onClick={() => { if (window.confirm('Отменить публикацию?')) void action('cancel'); }}>Отменить публикацию</button>}
        {post.status === 'scheduled' && <p className="notice">Публикация запланирована. Worker автопубликации будет реализован в Phase 3.</p>}
      </div></section>}
    </aside></div>
  </>;
}
