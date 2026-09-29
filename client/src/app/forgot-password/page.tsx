'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/apiClient';
import styles from './forgotPassword.module.css';

export default function ForgotPasswordPage() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The token only exists in the browser URL after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(new URLSearchParams(window.location.search).get('token') || '');
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (token && password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      if (token) {
        const response = await apiRequest<{ message?: string }>('/auth/password-reset/confirm', 'POST', { token, password });
        setNotice(response.message || 'Password updated. You can sign in now.');
        setPassword('');
        setConfirmPassword('');
        window.history.replaceState({}, '', '/forgot-password');
        setToken('');
      } else {
        const response = await apiRequest<{ message?: string }>('/auth/password-reset/request', 'POST', { email: email.trim() });
        setNotice(response.message || 'If an account matches that email, password reset instructions will be sent.');
      }
    } catch (cause: unknown) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };

  return <main className={styles.page}>
    <section className={styles.card}>
      <Link className={styles.brand} href="/">Aether StudyOS</Link>
      <h1 className={styles.title}>{token ? 'Choose a new password' : 'Reset your password'}</h1>
      <p className={styles.description}>{token ? 'Create a new password for your account. This reset link can only be used once.' : 'Enter your account email and we will send a secure, one-time reset link if it matches an account.'}</p>
      <form onSubmit={submit} className={styles.form}>
        {!token ? <label>Email address<input className={styles.input} required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label> : <>
          <label>New password<input className={styles.input} required type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label>Confirm new password<input className={styles.input} required type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        </>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        <button className={styles.submit} type="submit" disabled={busy}>{busy ? 'Please wait…' : token ? 'Save new password' : 'Send reset link'}</button>
      </form>
      <p className={styles.return}><Link href="/">Return to StudyOS</Link></p>
    </section>
  </main>;
}

function errorMessage(error: unknown) {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : 'We could not process your request. Please try again.';
}
