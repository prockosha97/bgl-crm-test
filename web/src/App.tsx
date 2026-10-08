import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { canEdit } from '../../shared/contracts';
import { Dashboard } from './pages/Dashboard';
import { Calendar } from './pages/Calendar';
import { PostEditor } from './pages/PostEditor';
import { Settings } from './pages/Settings';
import { Users } from './pages/Users';
export function App() {
  const { user, logout } = useAuth();
  return <div className="app"><aside className="sidebar"><div className="wordmark">БГЛ <span>Content Hub</span></div><nav>
    <NavLink to="/" end>Обзор</NavLink><NavLink to="/calendar">Календарь</NavLink><NavLink to="/backlog">Бэклог</NavLink>
    {canEdit(user.role) && <NavLink to="/posts/new">Новая публикация</NavLink>}
    <NavLink to="/settings">Справочники и каналы</NavLink>{user.role === 'ADMIN' && <NavLink to="/users">Пользователи</NavLink>}
  </nav><div className="account"><strong>{user.name}</strong><small>{user.role}</small><button onClick={() => void logout()}>Выйти</button></div></aside>
  <main className="workspace"><Routes><Route path="/" element={<Dashboard/>}/><Route path="/calendar" element={<Calendar/>}/><Route path="/backlog" element={<Calendar backlog/>}/><Route path="/posts/new" element={canEdit(user.role) ? <PostEditor/> : <Navigate to="/"/>}/><Route path="/posts/:id" element={<PostEditor/>}/><Route path="/settings" element={<Settings/>}/><Route path="/users" element={user.role === 'ADMIN' ? <Users/> : <Navigate to="/"/>}/><Route path="*" element={<p>Страница не найдена</p>}/></Routes></main></div>;
}
