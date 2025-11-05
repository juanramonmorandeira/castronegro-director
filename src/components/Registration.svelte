<script>
  import Topbar from './Topbar.svelte';
  import Footbar from './Footbar.svelte';
  import BackgroundLayer from './landing/BackgroundLayer.svelte';
  import { t } from '../lib/i18n.js';
  import { registerWithEmail, sendVerificationEmail } from '../lib/auth.js';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let name = '';
  let alias = '';
  let email = '';
  let password = '';
  let confirmPassword = '';

  const AVAILABLE_AVATARS = [
    { value: '/avatars/Avatar_Default.png', labelKey: 'registration.avatar_option.default' },
    { value: '/avatars/Avatar_Andrea.png', labelKey: 'registration.avatar_option.andrea' },
    { value: '/avatars/Avatar_Ramon.png', labelKey: 'registration.avatar_option.ramon' },
    { value: '/avatars/Avatar_Sofia.png', labelKey: 'registration.avatar_option.sofia' }
  ];

  let avatarURL = AVAILABLE_AVATARS[0].value;
  let avatarModalOpen = false;
  let pendingAvatar = avatarURL;

  let loading = false;
  let info = '';
  let error = '';

  $: namePlaceholder = $t('registration.name_placeholder');
  $: aliasPlaceholder = $t('registration.alias_placeholder');
  $: emailPlaceholder = $t('registration.email_placeholder');
  $: passwordPlaceholder = $t('registration.password_placeholder');
  $: confirmPasswordPlaceholder = $t('registration.confirm_password_placeholder');

  const passwordRules = {
    minLength: 10,
    uppercase: /[A-Z]/,
    lowercase: /[a-z]/,
    number: /[0-9]/,
    symbol: /[^A-Za-z0-9]/
  };

  function resetFeedback() {
    info = '';
    error = '';
  }

  function meetsPasswordRequirements(value = '') {
    return (
      value.length >= passwordRules.minLength &&
      passwordRules.uppercase.test(value) &&
      passwordRules.lowercase.test(value) &&
      passwordRules.number.test(value) &&
      passwordRules.symbol.test(value)
    );
  }

  function openAvatarModal() {
    pendingAvatar = avatarURL;
    avatarModalOpen = true;
  }

  function closeAvatarModal() {
    avatarModalOpen = false;
  }

  function selectPendingAvatar(url) {
    pendingAvatar = url;
  }

  function confirmAvatarSelection() {
    avatarURL = pendingAvatar;
    avatarModalOpen = false;
  }

  async function onSubmit() {
    resetFeedback();

    const normalizedEmail = email.trim().toLowerCase();

    if (password !== confirmPassword) {
      error = $t('registration.errors.password_mismatch');
      return;
    }

    if (!meetsPasswordRequirements(password)) {
      error = $t('registration.errors.password_strength');
      return;
    }

    loading = true;
    try {
      const user = await registerWithEmail(normalizedEmail, password, {
        name: name.trim(),
        alias: alias.trim(),
        avatarURL
      });

      await sendVerificationEmail();

      const messageEmail = user.email ?? normalizedEmail;
      info = $t('registration.success.verification_sent', { email: messageEmail });
      dispatch('registered', {
        uid: user.uid,
        email: messageEmail,
        status: 'inactive'
      });

      password = '';
      confirmPassword = '';
    } catch (err) {
      console.error('[registration]', err);
      if (err?.code === 'auth/email-already-in-use') {
        error = $t('registration.errors.email_in_use');
      } else {
        error = $t('registration.errors.registration_error');
      }
    } finally {
      loading = false;
    }
  }

  function goLogin() {
    dispatch('navigate-login');
  }
</script>

<BackgroundLayer />

<div class="page">
  <Topbar titleKey="registration.title" showUserMenu={false} />

  <main class="center">
    <div class="auth-layout">
      <form
        class="auth-card card-glass"
        on:submit|preventDefault={onSubmit}
        aria-label={$t('registration.title')}
      >
        <h2>{$t('registration.title')}</h2>
        <p class="intro">{$t('registration.intro')}</p>

        <div class="field">
          <label class="label" for="name">{$t('registration.name_label')}</label>
          <input
            id="name"
            name="name"
            class="input"
            type="text"
            bind:value={name}
            required
            autocomplete="name"
            placeholder={namePlaceholder}
          />
        </div>

        <div class="field">
          <label class="label" for="alias">
            {$t('registration.alias_label')}
            <small>({$t('registration.optional')})</small>
          </label>
          <input
            id="alias"
            name="alias"
            class="input"
            type="text"
            bind:value={alias}
            autocomplete="nickname"
            placeholder={aliasPlaceholder}
          />
        </div>

        <div class="field avatar-field">
          <span class="label">
            {$t('registration.avatar_label')}
            <small>({$t('registration.optional')})</small>
          </span>
          <div class="current-avatar">
            <img src={avatarURL} alt={$t('registration.avatar_selected_alt')} />
            <div class="current-avatar-actions">
              <span class="hint">{$t('registration.avatar_help')}</span>
              <button type="button" class="btn outline" on:click={openAvatarModal}>
                {$t('registration.avatar_change_button')}
              </button>
            </div>
          </div>
        </div>

        <div class="field">
          <label class="label" for="email">{$t('registration.email_label')}</label>
          <input
            id="email"
            name="email"
            class="input"
            type="email"
            bind:value={email}
            required
            autocomplete="email"
            placeholder={emailPlaceholder}
          />
        </div>

        <div class="field">
          <label class="label" for="password">{$t('registration.password_label')}</label>
          <input
            id="password"
            name="password"
            class="input"
            type="password"
            bind:value={password}
            required
            autocomplete="new-password"
            minlength={passwordRules.minLength}
            placeholder={passwordPlaceholder}
          />
          <small class="hint">{$t('registration.password_requirements')}</small>
        </div>

        <div class="field">
          <label class="label" for="confirm">{$t('registration.confirm_password_label')}</label>
          <input
            id="confirm"
            name="confirm"
            class="input"
            type="password"
            bind:value={confirmPassword}
            required
            autocomplete="new-password"
            minlength={passwordRules.minLength}
            placeholder={confirmPasswordPlaceholder}
          />
        </div>

        <div class="form-actions">
          <button class="btn primary" type="submit" disabled={loading}>
            {loading ? '…' : $t('registration.submit')}
          </button>
          <button type="button" class="link-button" on:click={goLogin}>
            {$t('registration.back_to_login')}
          </button>
        </div>

        {#if info}
          <p class="info" aria-live="polite">{info}</p>
        {/if}
        {#if error}
          <p class="error" aria-live="assertive">{error}</p>
        {/if}
      </form>
    </div>
  </main>

  <Footbar />

  {#if avatarModalOpen}
    <div class="modal-backdrop" on:click={closeAvatarModal} aria-hidden="true"></div>
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatarModalTitle"
      aria-describedby="avatarModalHelp"
      on:click|stopPropagation
    >
      <div class="modal-content">
        <h3 id="avatarModalTitle">{$t('registration.avatar_modal_title')}</h3>
        <p id="avatarModalHelp" class="modal-hint">{$t('registration.avatar_modal_help')}</p>

        <div class="avatar-options modal-grid" role="list">
          {#each AVAILABLE_AVATARS as avatar}
            <button
              type="button"
              class="avatar-option"
              class:selected={pendingAvatar === avatar.value}
              on:click={() => selectPendingAvatar(avatar.value)}
              aria-pressed={pendingAvatar === avatar.value}
              role="listitem"
            >
              <img src={avatar.value} alt={$t(avatar.labelKey)} />
              <span>{$t(avatar.labelKey)}</span>
            </button>
          {/each}
        </div>

        <div class="modal-actions">
          <button type="button" class="btn outline" on:click={closeAvatarModal}>
            {$t('common.actions.cancel')}
          </button>
          <button type="button" class="btn primary" on:click={confirmAvatarSelection}>
            {$t('common.actions.save')}
          </button>
        </div>
      </div>
    </div>
  {/if}
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

  .auth-layout {
    display: grid;
    gap: 1.5rem;
    width: min(480px, 90vw);
  }

  .auth-card {
    display: grid;
    gap: 1rem;
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

  .field {
    display: grid;
    gap: 0.35rem;
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

  .avatar-field {
    gap: 0.5rem;
  }

  .current-avatar {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .current-avatar img {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.45);
    box-shadow: 0 2px 14px rgba(0, 0, 0, 0.45);
  }

  .current-avatar-actions {
    display: grid;
    gap: 0.35rem;
  }

  .avatar-field .label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .avatar-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
    gap: 0.75rem;
  }

  .avatar-option {
    display: grid;
    gap: 0.35rem;
    justify-items: center;
    padding: 0.75rem 0.5rem;
    border-radius: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: rgba(255, 255, 255, 0.05);
    color: #f5f8fb;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }

  .avatar-option img {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.4);
    box-shadow: 0 2px 14px rgba(0, 0, 0, 0.45);
  }

  .avatar-option span {
    font-size: 0.85rem;
    font-weight: 600;
  }

  .avatar-option.selected {
    border-color: rgba(255, 232, 140, 0.9);
    box-shadow: 0 4px 16px rgba(255, 232, 140, 0.22);
    transform: translateY(-2px);
  }

  .avatar-option:focus-visible {
    outline: 2px solid rgba(255, 232, 140, 0.7);
    outline-offset: 3px;
  }

  .btn.outline {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.4);
    color: #f0f4f9;
    padding: 0.55rem 1.1rem;
    border-radius: 999px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  .btn.outline:hover,
  .btn.outline:focus-visible {
    border-color: rgba(255, 232, 140, 0.8);
    background: rgba(255, 255, 255, 0.08);
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
    z-index: 40;
  }

  .modal {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 2rem 1rem;
    z-index: 50;
  }

  .modal-content {
    width: min(480px, 92vw);
    display: grid;
    gap: 1.1rem;
    padding: 1.6rem;
    border-radius: 1.1rem;
    background: rgba(12, 18, 28, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
  }

  .modal-content h3 {
    margin: 0;
    font-size: 1.25rem;
    color: #f3f5f7;
  }

  .modal-hint {
    margin: 0;
    color: rgba(230, 236, 247, 0.8);
    font-size: 0.9rem;
  }

  .modal-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .form-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .btn.primary {
    background: rgba(74, 141, 74, 0.8);
    border: 1px solid rgba(74, 141, 74, 0.9);
    color: #f6fff6;
    padding: 0.65rem 1.4rem;
    border-radius: 999px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn.primary[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .link-button {
    display: inline;
    background: none;
    border: none;
    border-radius: 0;
    color: rgba(255, 230, 150, 0.9);
    padding: 0;
    text-decoration: underline;
    cursor: pointer;
    font-weight: 500;
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
