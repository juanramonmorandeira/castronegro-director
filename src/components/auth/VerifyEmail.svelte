<script>
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import Topbar from '../Topbar.svelte';
  import Footbar from '../Footbar.svelte';
  import { t } from '../../lib/i18n.js';
  import { confirmEmailVerification } from '../../lib/auth.js';

  const dispatch = createEventDispatcher();
  const translate = (key, vars) => get(t)(key, vars);

  let status = 'checking'; // checking | success | error | invalid
  let email = '';
  let errorCode = '';
  let redirectTimer;

  onMount(async () => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const mode = params?.get('mode');
    const code = params?.get('oobCode');

    if (!params || mode !== 'verifyEmail' || !code) {
      status = 'invalid';
      return;
    }

    status = 'checking';
    try {
      const result = await confirmEmailVerification(code);
      email = result?.email ?? '';
      status = 'success';
      redirectTimer = setTimeout(() => {
        goLogin();
      }, 2500);

      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('mode');
        url.searchParams.delete('oobCode');
        url.searchParams.delete('apiKey');
        url.searchParams.delete('lang');
        url.searchParams.delete('continueUrl');
        window.history.replaceState({}, '', url);
      }
    } catch (error) {
      console.error('Email verification failed:', error);
      errorCode = error?.code ?? 'unknown';
      status = 'error';
    }
  });

  onDestroy(() => {
    if (redirectTimer) {
      clearTimeout(redirectTimer);
    }
  });

  function goLogin() {
    dispatch('navigate-login');
  }

  $: heading =
    status === 'success'
      ? translate('verify.success_title')
      : status === 'checking'
        ? translate('verify.checking_title')
        : status === 'invalid'
          ? translate('verify.invalid_title')
          : translate('verify.error_title');
</script>

<div class="page">
  <Topbar titleKey="verify.title" showUserMenu={false} />

  <main class="center">
    <div class="card auth-card card-glass" aria-live="polite">
      <h2>{heading}</h2>

      {#if status === 'checking'}
        <p class="message info">{$t('verify.checking_message')}</p>
      {:else if status === 'success'}
        <p class="message success">
          {$t('verify.success_message', { email: email || $t('verify.unknown_email') })}
        </p>
        <p class="hint">{$t('verify.success_hint')}</p>
        <p class="redirect">{$t('verify.success_redirect')}</p>
      {:else if status === 'invalid'}
        <p class="message error">{$t('verify.invalid_message')}</p>
      {:else if status === 'error'}
        <p class="message error">
          {$t('verify.error_message', {
            reason:
              errorCode === 'auth/invalid-action-code'
                ? $t('verify.error_invalid_code')
                : errorCode === 'auth/expired-action-code'
                  ? $t('verify.error_expired_code')
                  : $t('verify.error_generic_reason')
          })}
        </p>
      {/if}

      <button
        class="btn primary"
        type="button"
        on:click={goLogin}
        disabled={status === 'checking' || status === 'success'}
      >
        {$t('verify.go_login')}
      </button>
    </div>
  </main>

  <Footbar />
</div>

<style>
  .page {
    min-height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr auto;
  }

  .center {
    display: grid;
    place-items: center;
    padding: 2rem 1rem;
  }

  .auth-card {
    display: grid;
    gap: 1rem;
    width: min(460px, 92vw);
    padding: clamp(1.5rem, 3vw, 2.25rem);
    text-align: center;
  }

  .auth-card h2 {
    margin: 0;
    font-family: "Merriweather", serif;
    font-size: clamp(1.8rem, 3vw, 2.2rem);
    color: #f4d47c;
    text-shadow:
      0 0 8px rgba(255, 200, 60, 0.7),
      0 0 18px rgba(255, 180, 40, 0.4),
      2px 2px 10px rgba(0, 0, 0, 0.85);
  }

  .message {
    margin: 0;
    font-size: 1rem;
  }

  .message.info {
    color: rgba(230, 236, 247, 0.85);
  }

  .message.success {
    color: #d7ffb6;
  }

  .message.error {
    color: #ffb8b8;
  }

  .hint {
    margin: 0;
    font-size: 0.9rem;
    color: rgba(245, 245, 245, 0.75);
  }

  .btn.primary {
    margin: 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: none;
    cursor: pointer;
    padding: 0.65rem 1.6rem;
    font-weight: 600;
    background: rgba(74, 141, 74, 0.85);
    border: 1px solid rgba(74, 141, 74, 0.95);
    color: #f6fff6;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .btn.primary:hover,
  .btn.primary:focus-visible {
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgba(74, 141, 74, 0.35);
  }

  .btn.primary[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .redirect {
    margin: 0;
    font-size: 0.85rem;
    color: rgba(245, 245, 245, 0.7);
  }
</style>
