<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import Topbar from './Topbar.svelte';
  import Footbar from './Footbar.svelte';
  import BackgroundLayer from './landing/BackgroundLayer.svelte';
  import { t } from '../lib/i18n.js';
  import {
    fetchCurrentUserProfile,
    updateUserProfile,
    changeUserEmail,
    changeUserPassword
  } from '../lib/auth.js';
  import { get } from 'svelte/store';

  const passwordRules = {
    minLength: 10,
    uppercase: /[A-Z]/,
    lowercase: /[a-z]/,
    number: /[0-9]/,
    symbol: /[^A-Za-z0-9]/
  };

  const dispatch = createEventDispatcher();

  export let user = null;

  const translate = (key, vars) => get(t)(key, vars);

  let name = '';
  let alias = '';
  let email = '';
  let status = 'inactive';

  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';

  let loading = false;
  let info = '';
  let error = '';

  const resetMessages = () => {
    info = '';
    error = '';
  };

  function meetsPasswordRequirements(value = '') {
    return (
      value.length >= passwordRules.minLength &&
      passwordRules.uppercase.test(value) &&
      passwordRules.lowercase.test(value) &&
      passwordRules.number.test(value) &&
      passwordRules.symbol.test(value)
    );
  }

  async function loadProfile() {
    const profile = user ?? (await fetchCurrentUserProfile());
    if (!profile) return;
    user = profile;
    name = profile.name ?? '';
    alias = profile.alias ?? '';
    email = profile.email ?? '';
    status = profile.status ?? 'inactive';
  }

  onMount(() => {
    loadProfile().catch((err) => {
      console.error('Unable to load profile', err);
    });
  });

  async function onSubmit(event) {
    event?.preventDefault();
    resetMessages();

    const trimmedName = name.trim();
    const trimmedAlias = alias.trim();
    const trimmedEmail = email.trim().toLowerCase();

    const originalEmail = (user?.email ?? '').toLowerCase();
    const emailChanged = trimmedEmail && trimmedEmail !== originalEmail;
    const passwordChanged = newPassword.length > 0 || confirmPassword.length > 0;
    const hasProfileChanges =
      trimmedName !== (user?.name ?? '') ||
      trimmedAlias !== (user?.alias ?? '') ||
      emailChanged ||
      passwordChanged;

    if (!hasProfileChanges) {
      info = translate('profile.success.no_changes');
      return;
    }

    if (passwordChanged) {
      if (!newPassword) {
        error = translate('profile.errors.password_required');
        return;
      }
      if (newPassword !== confirmPassword) {
        error = translate('profile.errors.password_mismatch');
        return;
      }
      if (!meetsPasswordRequirements(newPassword)) {
        error = translate('profile.errors.password_strength');
        return;
      }
    }

    const requiresReauth = emailChanged || passwordChanged;
    if (requiresReauth && !currentPassword) {
      error = translate('profile.errors.missing_current_password');
      return;
    }

    loading = true;
    try {
      if (passwordChanged) {
        await changeUserPassword(currentPassword, newPassword);
      }

      if (trimmedName !== (user?.name ?? '') || trimmedAlias !== (user?.alias ?? '')) {
        await updateUserProfile({ name: trimmedName, alias: trimmedAlias });
      }

      if (!emailChanged) {
        const refreshed = await fetchCurrentUserProfile();
        status = refreshed?.status ?? status;
        if (refreshed) {
          user = refreshed;
        }
        info = passwordChanged
          ? translate('profile.success.password_updated')
          : translate('profile.success.profile_updated');
        currentPassword = '';
        newPassword = '';
        confirmPassword = '';
        dispatch('updated', { user: refreshed });
        return;
      }

      await changeUserEmail(currentPassword, trimmedEmail);
      info = translate('profile.success.email_verification_sent', { email: trimmedEmail });
      dispatch('email-change');
    } catch (err) {
      console.error('[profile.update]', err);
      const code = err?.code ?? '';
      if (code === 'auth/wrong-password') {
        error = translate('profile.errors.invalid_current_password');
      } else if (code === 'auth/too-many-requests') {
        error = translate('profile.errors.too_many_attempts');
      } else if (code === 'auth/requires-recent-login') {
        error = translate('profile.errors.requires_recent_login');
      } else if (code === 'auth/email-already-in-use') {
        error = translate('profile.errors.email_in_use');
      } else {
        error = translate('profile.errors.generic');
      }
    } finally {
      loading = false;
    }
  }

  function goBack() {
    dispatch('close');
  }

  function relay(event) {
    dispatch(event.type, event.detail);
  }
</script>

<BackgroundLayer />

<div class="page">
  <Topbar titleKey="profile.title" user={user} on:profile={relay} on:logout={relay} />

  <main class="center">
    <form class="auth-card card-glass" on:submit|preventDefault={onSubmit} aria-label={$t('profile.title')}>
      <h2>{$t('profile.title')}</h2>
      <p class="intro">{$t('profile.intro')}</p>

      <div class="status">
        <span class:inactive={status !== 'active'}>
          {status === 'active' ? $t('profile.status.active') : $t('profile.status.inactive')}
        </span>
      </div>

      <div class="field">
        <label class="label" for="name">{$t('profile.name_label')}</label>
        <input
          id="name"
          class="input"
          type="text"
          bind:value={name}
          required
          autocomplete="name"
          placeholder={$t('profile.name_placeholder')}
        />
      </div>

      <div class="field">
        <label class="label" for="alias">
          {$t('profile.alias_label')}
          <small>({$t('profile.optional')})</small>
        </label>
        <input
          id="alias"
          class="input"
          type="text"
          bind:value={alias}
          autocomplete="nickname"
          placeholder={$t('profile.alias_placeholder')}
        />
      </div>

      <div class="field">
        <label class="label" for="email">{$t('profile.email_label')}</label>
        <input
          id="email"
          class="input"
          type="email"
          bind:value={email}
          required
          autocomplete="email"
          placeholder={$t('profile.email_placeholder')}
        />
        <small class="hint">{$t('profile.email_hint')}</small>
      </div>

      <hr class="divider" />

      <p class="section-title">{$t('profile.security_section')}</p>

      <div class="field">
        <label class="label" for="current-password">
          {$t('profile.current_password_label')}
          <small>({$t('profile.required_for_sensitive')})</small>
        </label>
        <input
          id="current-password"
          class="input"
          type="password"
          bind:value={currentPassword}
          autocomplete="current-password"
          placeholder={$t('profile.current_password_placeholder')}
        />
      </div>

      <div class="field">
        <label class="label" for="new-password">
          {$t('profile.new_password_label')}
          <small>({$t('profile.optional')})</small>
        </label>
        <input
          id="new-password"
          class="input"
          type="password"
          bind:value={newPassword}
          autocomplete="new-password"
          minlength={passwordRules.minLength}
          placeholder={$t('profile.new_password_placeholder')}
        />
        <small class="hint">{$t('profile.password_requirements')}</small>
      </div>

      <div class="field">
        <label class="label" for="confirm-password">
          {$t('profile.confirm_password_label')}
          <small>({$t('profile.optional')})</small>
        </label>
        <input
          id="confirm-password"
          class="input"
          type="password"
          bind:value={confirmPassword}
          autocomplete="new-password"
          minlength={passwordRules.minLength}
          placeholder={$t('profile.confirm_password_placeholder')}
        />
      </div>

      <div class="actions">
        <button class="btn primary" type="submit" disabled={loading}>
          {loading ? '…' : $t('profile.save')}
        </button>
        <button class="link-button" type="button" on:click={goBack}>
          {$t('profile.back')}
        </button>
      </div>

      {#if info}
        <p class="info" aria-live="polite">{info}</p>
      {/if}
      {#if error}
        <p class="error" aria-live="assertive">{error}</p>
      {/if}
    </form>
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
    width: min(520px, 92vw);
    padding: clamp(1.5rem, 3vw, 2.25rem);
  }

  .auth-card h2 {
    margin: 0;
    text-align: center;
    font-family: "Merriweather", serif;
    font-size: clamp(1.8rem, 3vw, 2.2rem);
    color: #f4d47c;
    text-shadow:
      0 0 8px rgba(255, 200, 60, 0.7),
      0 0 18px rgba(255, 180, 40, 0.4),
      2px 2px 10px rgba(0, 0, 0, 0.85);
  }

  .intro {
    margin: 0;
    text-align: center;
    color: rgba(255, 255, 255, 0.85);
    font-size: 0.95rem;
  }

  .status {
    display: flex;
    justify-content: center;
  }

  .status span {
    padding: 0.2rem 0.75rem;
    border-radius: 999px;
    font-size: 0.85rem;
    background: rgba(74, 141, 74, 0.85);
    border: 1px solid rgba(74, 141, 74, 0.95);
    color: #f6fff6;
  }

  .status span.inactive {
    background: rgba(180, 75, 75, 0.85);
    border-color: rgba(180, 75, 75, 0.95);
  }

  .field {
    display: grid;
    gap: 0.5rem;
  }

  .section-title {
    margin: 0;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.85rem;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.7);
  }

  .label {
    font-weight: 600;
    color: #f0f3f7;
  }

  .label small {
    margin-left: 0.35rem;
    font-weight: 500;
    color: rgba(240, 244, 249, 0.75);
  }

  .input {
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    padding: 0.65rem 0.8rem;
    background: rgba(0, 0, 0, 0.3);
    color: #f5f8fb;
    font-size: 1rem;
  }

  .input:focus {
    outline: 2px solid rgba(255, 232, 140, 0.6);
    outline-offset: 2px;
  }

  .hint {
    font-size: 0.85rem;
    color: rgba(230, 236, 247, 0.8);
  }

  .divider {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    margin: 0.75rem 0;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: none;
    cursor: pointer;
    padding: 0.65rem 1.4rem;
    font-weight: 600;
  }

  .btn.primary {
    background: rgba(74, 141, 74, 0.8);
    border: 1px solid rgba(74, 141, 74, 0.9);
    color: #f6fff6;
  }

  .btn.primary[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .link-button {
    background: none;
    border: none;
    color: rgba(255, 230, 150, 0.9);
    cursor: pointer;
    text-decoration: underline;
    font-weight: 500;
    padding: 0;
  }

  .link-button:hover {
    color: rgba(255, 240, 180, 1);
  }

  .info {
    color: #ffd27f;
    font-size: 0.95rem;
    margin: 0;
  }

  .error {
    color: #ff9b9b;
    font-size: 0.95rem;
    margin: 0;
  }
</style>
