import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { AdminRegionProvider } from '../RegionContext';
import AdminPage from './AdminPage';
import NationalAIUsageDashboard from '../components/NationalAIUsageDashboard';
import '../admin-entry.css';

type Region = { id: string; regionName: string; serviceName: string };
type Principal = {
  sub: string;
  username: string;
  role: 'VIEWER' | 'REGIONAL_MANAGER' | 'PLATFORM_ADMIN';
  regions: string[];
};
type Session = { token: string; principal: Principal };

const TOKEN_KEY = 'copilot-access-token';
const PRINCIPAL_KEY = 'copilot-principal';

function storedSession(): Session | undefined {
  const token = sessionStorage.getItem(TOKEN_KEY);
  try {
    const principal = JSON.parse(sessionStorage.getItem(PRINCIPAL_KEY) || 'null');
    return token && principal ? { token, principal } : undefined;
  } catch {
    return undefined;
  }
}

export default function AdminEntry() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | undefined>(storedSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [regions, setRegions] = useState<Region[]>([]);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const initial =
    location.pathname.match(/^\/([^/]+)\/admin\/?$/)?.[1] ||
    new URLSearchParams(location.search).get('regionId') ||
    '';
  const region = regions.find((item) => item.id === initial);

  useEffect(() => {
    const previous = document.title;
    document.title = '전국 공통 관리자';
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    let current = true;
    setRegions([]);
    setError('');
    if (!session?.token) return;
    setChecking(true);
    api
      .get('/admin/regions', {
        headers: { Authorization: `Bearer ${session.token}` },
      })
      .then(({ data }) => {
        if (!Array.isArray(data)) throw new Error();
        if (current) setRegions(data);
      })
      .catch(() => {
        if (!current) return;
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(PRINCIPAL_KEY);
        sessionStorage.removeItem('admin-write-token');
        setSession(undefined);
        setError('로그인이 만료되었거나 관리자 권한이 없습니다. 다시 로그인해 주세요.');
      })
      .finally(() => {
        if (current) setChecking(false);
      });
    return () => {
      current = false;
    };
  }, [session?.token]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setChecking(true);
    try {
      const { data } = await api.post('/copilot/auth/login', {
        username,
        password,
      });
      if (
        !data?.accessToken ||
        !['PLATFORM_ADMIN', 'REGIONAL_MANAGER'].includes(data?.principal?.role)
      )
        throw new Error();
      sessionStorage.setItem(TOKEN_KEY, data.accessToken);
      sessionStorage.setItem(PRINCIPAL_KEY, JSON.stringify(data.principal));
      sessionStorage.removeItem('admin-write-token');
      setPassword('');
      setSession({ token: data.accessToken, principal: data.principal });
      window.dispatchEvent(new Event('copilot-session-change'));
    } catch {
      setError('아이디·비밀번호 또는 관리자 권한을 확인해 주세요.');
      setChecking(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordMessage('');
    if (newPassword !== newPasswordConfirm) {
      setPasswordMessage('새 비밀번호가 서로 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 12) {
      setPasswordMessage('새 비밀번호는 12자 이상으로 입력해 주세요.');
      return;
    }
    setPasswordChanging(true);
    try {
      await api.post(
        '/copilot/auth/change-password',
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${session?.token}` } },
      );
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
      setPasswordMessage('비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용해 주세요.');
    } catch (requestError: any) {
      setPasswordMessage(
        requestError?.response?.data?.message ||
          '현재 비밀번호를 확인한 뒤 다시 시도해 주세요.',
      );
    } finally {
      setPasswordChanging(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(PRINCIPAL_KEY);
    sessionStorage.removeItem('admin-write-token');
    setSession(undefined);
    setRegions([]);
    setError('');
    navigate('/admin', { replace: true });
    window.dispatchEvent(new Event('copilot-session-change'));
  };

  return (
    <main className="admin-entry">
      <section className="card">
        <h1>전국 공통 관리자</h1>
        {!session ? (
          <form onSubmit={login}>
            <label>
              아이디
              <input
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <label>
              비밀번호
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button disabled={checking || !username || !password}>
              {checking ? '로그인 중…' : '로그인'}
            </button>
          </form>
        ) : (
          <div>
            <p>
              {session.principal.username} ·{' '}
              {session.principal.role === 'PLATFORM_ADMIN'
                ? '전국 관리자'
                : '지역 관리자'}
            </p>
            <button type="button" onClick={logout}>
              로그아웃
            </button>
            <details>
              <summary>내 비밀번호 변경</summary>
              <form onSubmit={changePassword}>
                <label>
                  현재 비밀번호
                  <input
                    type="password"
                    name="currentPassword"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                </label>
                <label>
                  새 비밀번호
                  <input
                    type="password"
                    name="newPassword"
                    autoComplete="new-password"
                    minLength={12}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </label>
                <label>
                  새 비밀번호 확인
                  <input
                    type="password"
                    name="newPasswordConfirm"
                    autoComplete="new-password"
                    minLength={12}
                    value={newPasswordConfirm}
                    onChange={(event) => setNewPasswordConfirm(event.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  disabled={
                    passwordChanging ||
                    !currentPassword ||
                    !newPassword ||
                    !newPasswordConfirm
                  }
                >
                  {passwordChanging ? '변경 중…' : '비밀번호 변경'}
                </button>
              </form>
              {passwordMessage && (
                <p role="status">{passwordMessage}</p>
              )}
            </details>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        {session && checking && <p role="status">관리 권한을 확인하는 중입니다.</p>}
        {session && (
          <label>
            관리 지역
            <select
              aria-label="관리 지역"
              value={region?.id || ''}
              disabled={checking || !regions.length}
              onChange={(event) =>
                navigate(
                  '/admin' +
                    (event.target.value
                      ? '?regionId=' + encodeURIComponent(event.target.value)
                      : ''),
                )
              }
            >
              <option value="">
                {session.principal.role === 'PLATFORM_ADMIN'
                  ? '전국 전체 — 지역을 선택하세요'
                  : '권한 있는 지역을 선택해 주세요'}
              </option>
              {regions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.regionName}
                </option>
              ))}
            </select>
          </label>
        )}
        {session && !checking && initial && !region && (
          <p role="alert">
            요청한 지역의 관리 권한이 없습니다. 허용된 지역을 선택해 주세요.
          </p>
        )}
        {session && !checking && !regions.length && !error && (
          <p>관리 가능한 지역이 없습니다.</p>
        )}      </section>

      {session?.principal.role === 'PLATFORM_ADMIN' && (
        <NationalAIUsageDashboard />
      )}

      {region && session && (
        <AdminRegionProvider region={region}>
          <AdminPage key={region.id} adminToken={session.token} />
        </AdminRegionProvider>
      )}
    </main>
  );
}
