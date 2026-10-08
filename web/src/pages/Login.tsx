import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { loginSchema } from '../../../shared/contracts';
import { api, setCsrf, type User } from '../api';
import { ErrorMessage } from '../components/Common';
export function Login() {
  const client = useQueryClient(); const [error, setError] = useState<Error | null>(null);
  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm({ resolver: zodResolver(loginSchema) });
  return <main className="login"><div className="brand-mark">БГЛ</div><h1>BGL Content Hub</h1><p>Контент команды — в одном месте</p>
    <form onSubmit={handleSubmit(async values => { try { const result = await api<{ user: User; csrfToken: string }>('/auth/login', 'POST', values); setCsrf(result.csrfToken); client.setQueryData(['session'], result.user); } catch (error) { setError(error as Error); } })}>
      <label>Email<input type="email" autoComplete="username" {...register('email')} /></label>
      <label>Пароль<input type="password" autoComplete="current-password" {...register('password')} /></label>
      {errors.email && <p className="error">{errors.email.message}</p>}<ErrorMessage error={error}/>
      <button className="primary" disabled={isSubmitting}>Войти</button>
    </form><small>Учётную запись создаёт администратор.</small>
  </main>;
}
