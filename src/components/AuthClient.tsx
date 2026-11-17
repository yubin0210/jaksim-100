'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckIcon, SproutIcon, SunIcon } from '@/components/Icons';

export function AuthClient() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmationMsg, setConfirmationMsg] = useState<string | null>(null);

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
          '가입 확인 메일을 보내드렸어요. 메일함에서 인증 링크를 누른 뒤 로그인해 주세요.'
        );
        setMode('login');
        return;
      }

      router.push('/');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="screen-scroll"
      style={{
        justifyContent: 'center',
        padding: '26px 20px',
        gap: '16px',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'var(--accent-coral-soft)',
            color: 'var(--accent-coral)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '10px',
            boxShadow: '0 6px 16px rgba(238, 99, 72, 0.16)',
          }}
        >
          <SunIcon size={22} />
        </div>
        <div
          style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            color: 'var(--accent-coral)',
            letterSpacing: '0.02em',
            marginBottom: '4px',
          }}
        >
          온기보드 · 자기계발 사진 인증 메이트
        </div>
        <h1
          style={{
            fontSize: '1.28rem',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            lineHeight: 1.35,
            color: 'var(--ink-primary)',
          }}
        >
          오늘의 작은 한 걸음,
          <br />
          다정한 메이트와 시작해요
        </h1>
      </div>

      <div
        className="card-ivory"
        style={{
          padding: '18px 16px',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '13px',
        }}
      >
        {/* Mode Switch */}
        <div
          role="tablist"
          aria-label="로그인 또는 회원가입 선택"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'var(--phone-bg)',
            border: '1px solid var(--border-soft)',
            borderRadius: '14px',
            padding: '4px',
            gap: '4px',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => switchMode('login')}
            style={{
              border: 'none',
              borderRadius: '10px',
              padding: '8px 0',
              fontFamily: 'inherit',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              background:
                mode === 'login' ? 'var(--accent-coral)' : 'transparent',
              color: mode === 'login' ? '#fff' : 'var(--ink-secondary)',
            }}
          >
            로그인
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            onClick={() => switchMode('signup')}
            style={{
              border: 'none',
              borderRadius: '10px',
              padding: '8px 0',
              fontFamily: 'inherit',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              background:
                mode === 'signup' ? 'var(--accent-coral)' : 'transparent',
              color: mode === 'signup' ? '#fff' : 'var(--ink-secondary)',
            }}
          >
            회원가입
          </button>
        </div>

        {confirmationMsg && (
          <div
            style={{
              background: 'var(--accent-sage-soft)',
              border: '1px solid #9DD0AB',
              color: '#2F6440',
              borderRadius: '12px',
              padding: '9px 11px',
              fontSize: '0.74rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '7px',
              lineHeight: 1.4,
            }}
          >
            <CheckIcon size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{confirmationMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              background: '#FFF0EB',
              border: '1px solid #F29C85',
              color: '#A5351E',
              borderRadius: '12px',
              padding: '9px 11px',
              fontSize: '0.74rem',
              fontWeight: 700,
              lineHeight: 1.4,
            }}
          >
            {errorMsg}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}
        >
          {mode === 'signup' && (
            <div>
              <label
                htmlFor="auth-nickname"
                style={{
                  display: 'block',
                  fontSize: '0.71rem',
                  fontWeight: 700,
                  color: 'var(--ink-secondary)',
                  marginBottom: '5px',
                }}
              >
                닉네임 (2~12자)
              </label>
              <input
                id="auth-nickname"
                type="text"
                required
                minLength={2}
                maxLength={12}
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="보드에서 부를 이름"
                style={{
                  width: '100%',
                  background: 'var(--phone-bg)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  fontFamily: 'inherit',
                  fontSize: '0.82rem',
                  color: 'var(--ink-primary)',
                }}
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              style={{
                display: 'block',
                fontSize: '0.71rem',
                fontWeight: 700,
                color: 'var(--ink-secondary)',
                marginBottom: '5px',
              }}
            >
              이메일
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@example.com"
              style={{
                width: '100%',
                background: 'var(--phone-bg)',
                border: '1px solid var(--border-soft)',
                borderRadius: '12px',
                padding: '10px 12px',
                fontFamily: 'inherit',
                fontSize: '0.82rem',
                color: 'var(--ink-primary)',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              style={{
                display: 'block',
                fontSize: '0.71rem',
                fontWeight: 700,
                color: 'var(--ink-secondary)',
                marginBottom: '5px',
              }}
            >
              비밀번호 (6자 이상)
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              autoComplete={
                mode === 'signup' ? 'new-password' : 'current-password'
              }
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              style={{
                width: '100%',
                background: 'var(--phone-bg)',
                border: '1px solid var(--border-soft)',
                borderRadius: '12px',
                padding: '10px 12px',
                fontFamily: 'inherit',
                fontSize: '0.82rem',
                color: 'var(--ink-primary)',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '4px',
              width: '100%',
              border: 'none',
              background: 'var(--accent-coral)',
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: '0.84rem',
              fontWeight: 800,
              padding: '12px',
              borderRadius: '15px',
              cursor: submitting ? 'wait' : 'pointer',
              boxShadow: '0 6px 14px rgba(238, 99, 72, 0.28)',
            }}
          >
            {submitting
              ? mode === 'signup'
                ? '계정 만드는 중...'
                : '로그인 중...'
              : mode === 'signup'
                ? '온기보드 시작하기'
                : '로그인'}
          </button>
        </form>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontSize: '0.7rem',
          color: 'var(--ink-secondary)',
          fontWeight: 600,
        }}
      >
        <SproutIcon size={13} style={{ color: 'var(--accent-sage)' }} />
        <span>실시간 촬영 한 장으로 기록하는 자기계발 보드</span>
      </div>
    </div>
  );
}
