'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Brand } from './Brand';

export function AuthClient({ initialNotice }: { initialNotice: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmationMsg, setConfirmationMsg] = useState(initialNotice);

  const switchMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode);
    setErrorMsg(null);
    setConfirmationMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setConfirmationMsg(null);
    setSubmitting(true);

    try {
      const endpoint =
        mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const payload =
        mode === 'signup'
          ? { email: email.trim(), password, nickname: nickname.trim() }
          : { email: email.trim(), password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(json.error || '요청을 처리하지 못했어요.');
        return;
      }

      if (mode === 'signup' && json.needsEmailConfirmation) {
        setConfirmationMsg(
          '가입 확인 메일을 보냈어요. 이 브라우저에서 인증 링크를 열면 바로 시작할 수 있어요.'
        );
        setMode('login');
        return;
      }

      const next =
        new URLSearchParams(window.location.search).get('next') ?? '/';
      router.replace(
        /^\/(?:rooms\/[\w-]+|explore|album)$/.test(next) ? next : '/'
      );
      router.refresh();
    } catch {
      setErrorMsg('연결이 끊겼어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const signup = mode === 'signup';
  return (
    <main className="auth-page">
      <header className="auth-mast">
        <Brand />
      </header>
      <div className="auth-layout">
        <section className="auth-story">
          <h1>
            혼자 미루던 일,
            <br />
            <em>같이 해봐요.</em>
          </h1>
          <p>
            같은 목표를 가진 친구의 인증 사진을 보면 ‘나도 오늘 해볼까?’ 하는
            마음이 들어요. 오늘 내가 남긴 한 장도 누군가에게 그런 힘이 돼요.
          </p>
          <figure className="desk-print">
            <img
              src="/images/journal-desk.jpg"
              alt="오후 햇살이 비치는 책상 위의 노트와 작은 사진"
            />
          </figure>
        </section>
        <section className="auth-panel">
          <h2>{signup ? '처음 만나 반가워요.' : '다시 만나 반가워요.'}</h2>
          <div className="switcher" aria-label="계정 메뉴">
            <button
              type="button"
              aria-pressed={!signup}
              disabled={submitting}
              onClick={() => switchMode('login')}
            >
              로그인
            </button>
            <button
              type="button"
              aria-pressed={signup}
              disabled={submitting}
              onClick={() => switchMode('signup')}
            >
              회원가입
            </button>
          </div>
          <form className="stack" onSubmit={handleSubmit}>
            {signup && (
              <label>
                닉네임
                <input
                  required
                  minLength={2}
                  maxLength={12}
                  autoComplete="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="방에서 사용할 이름 (2~12자)"
                />
              </label>
            )}
            <label>
              이메일
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </label>
            <label>
              비밀번호
              <input
                required
                type="password"
                minLength={signup ? 6 : undefined}
                autoComplete={signup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  signup ? '6자 이상 입력해 주세요' : '비밀번호를 입력해 주세요'
                }
              />
            </label>
            {errorMsg && (
              <p className="error" role="alert">
                {errorMsg}
              </p>
            )}
            {confirmationMsg && (
              <p className="notice" role="status">
                {confirmationMsg}
              </p>
            )}
            <button className="primary" disabled={submitting}>
              {submitting ? '잠시만요…' : signup ? '가입하기' : '로그인'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
