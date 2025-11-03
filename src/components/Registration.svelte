<script>
  import Topbar from './Topbar.svelte';
  import Footbar from './Footbar.svelte';
  import BackgroundLayer from './landing/BackgroundLayer.svelte';
  import { t } from '../lib/i18n.js';
  import { registerWithEmail, sendVerificationEmail } from '../lib/auth.js';
  import { uploadAvatarToDrive } from '../lib/storage.js';
  import { createEventDispatcher, onDestroy } from 'svelte';

  const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
  const ACCEPTED_AVATAR_TYPES = ['image/png', 'image/jpeg'];
  const ACCEPTED_AVATAR_STRING = ACCEPTED_AVATAR_TYPES.join(',');

  const dispatch = createEventDispatcher();

  let name = '';
  let alias = '';
  let email = '';
  let password = '';
  let confirmPassword = '';

  let avatarURL = '';
  let avatarDriveId = '';
  let avatarPreview = '';
  let avatarUploading = false;
  let avatarUploadError = '';
  let avatarInput;

  let loading = false;
  let info = '';
  let error = '';

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

  function clearAvatarState() {
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
    avatarPreview = '';
    avatarURL = '';
    avatarDriveId = '';
    avatarUploadError = '';
    if (avatarInput) {
      avatarInput.value = '';
    }
  }

  onDestroy(() => {
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
  });

  function meetsPasswordRequirements(value = '') {
    return (
      value.length >= passwordRules.minLength &&
      passwordRules.uppercase.test(value) &&
      passwordRules.lowercase.test(value) &&
      passwordRules.number.test(value) &&
      passwordRules.symbol.test(value)
    );
  }

  async function handleAvatarChange(event) {
    resetFeedback();
    avatarUploadError = '';

    const file = event?.currentTarget?.files?.[0];
    if (!file) {
      clearAvatarState();
      return;
    }

    if (!ACCEPTED_AVATAR_TYPES.includes(file.type) || file.size > MAX_AVATAR_SIZE) {
      clearAvatarState();
      avatarUploadError = $t('registration.errors.upload_failed');
      return;
    }

    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
    const temporaryPreview = URL.createObjectURL(file);
    avatarPreview = temporaryPreview;

    avatarUploading = true;
    try {
      const upload = await uploadAvatarToDrive(file, {
        fileName: `avatar-${Date.now()}-${file.name}`
      });

      if (temporaryPreview && temporaryPreview.startsWith('blob:')) {
        URL.revokeObjectURL(temporaryPreview);
      }

      avatarPreview = upload.url;
      avatarURL = upload.url;
      avatarDriveId = upload.driveId;
    } catch (err) {
      console.error('Avatar upload error', err);
      if (temporaryPreview && temporaryPreview.startsWith('blob:')) {
        URL.revokeObjectURL(temporaryPreview);
      }
      avatarPreview = '';
      avatarURL = '';
      avatarDriveId = '';

      if (err?.message === 'missing_upload_endpoint') {
        avatarUploadError = $t('registration.errors.upload_not_configured');
      } else {
        avatarUploadError = $t('registration.errors.upload_failed');
      }
    } finally {
      avatarUploading = false;
    }
  }

  function handleAvatarRemove() {
    clearAvatarState();
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
        avatarURL,
        avatarDriveId
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
  <Topbar titleKey="registration.title" />

  <main class="center">
    <form
      class="card-glass form"
      on:submit|preventDefault={onSubmit}
      aria-label={$t('registration.title')}
    >
      <h2 class="title">{$t('registration.title')}</h2>
      <p class="intro">{$t('registration.intro')}</p>

      <label class="label" for="name">{$t('registration.name_label')}</label>
      <input
        id="name"
        name="name"
        class="input"
        type="text"
        bind:value={name}
        required
        autocomplete="name"
      />

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
      />

      <div class="avatar-field">
        <label class="label" for="avatar">
          {$t('registration.avatar_label')}
          <small>({$t('registration.optional')})</small>
        </label>
        <input
          id="avatar"
          type="file"
          class="input file-input"
          accept={ACCEPTED_AVATAR_STRING}
          on:change={handleAvatarChange}
          bind:this={avatarInput}
          aria-describedby="avatar-help"
        />
        <small id="avatar-help" class="hint">{$t('registration.avatar_help')}</small>

        {#if avatarUploadError}
          <p class="error" aria-live="assertive">{avatarUploadError}</p>
        {/if}

        {#if avatarUploading}
          <p class="info" aria-live="polite">{$t('registration.uploading')}</p>
        {/if}

        {#if avatarPreview}
          <div class="avatar-preview">
            <img src={avatarPreview} alt={$t('registration.avatar_label')} />
            <button type="button" class="link-button" on:click={handleAvatarRemove}>
              {$t('common.actions.delete')}
            </button>
          </div>
        {/if}

        {#if avatarURL}
          <p class="avatar-link">
            <a href={avatarURL} target="_blank" rel="noopener">
              {avatarURL}
            </a>
          </p>
        {/if}
      </div>

      <label class="label" for="email">{$t('registration.email_label')}</label>
      <input
        id="email"
        name="email"
        class="input"
        type="email"
        bind:value={email}
        required
        autocomplete="email"
      />

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
      />
      <small class="hint">{$t('registration.password_requirements')}</small>

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
      />

      <button class="btn big" type="submit" disabled={loading || avatarUploading}>
        {loading ? '…' : $t('registration.submit')}
      </button>

      {#if info}
        <p class="info" aria-live="polite">{info}</p>
      {/if}
      {#if error}
        <p class="error" aria-live="assertive">{error}</p>
      {/if}

      <p class="login-hint">
        <button type="button" class="link-button" on:click={goLogin}>
          {$t('registration.back_to_login')}
        </button>
      </p>
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

  .form {
    display: grid;
    gap: 0.75rem;
    padding: 1.75rem;
    min-width: 280px;
    width: min(560px, 92vw);
  }

  .title {
    margin: 0 0 0.5rem;
    text-align: center;
  }

  .intro {
    margin: 0 0 0.5rem;
    text-align: center;
    color: rgba(255, 255, 255, 0.85);
  }

  .label {
    font-weight: 600;
    color: #f0f3f7;
  }

  .input {
    padding: 0.65rem 0.8rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: rgba(0, 0, 0, 0.3);
    color: #f5f8fb;
    font-size: 1rem;
  }

  .input:focus {
    outline: 2px solid rgba(255, 232, 140, 0.6);
    outline-offset: 2px;
  }

  .file-input {
    padding: 0.4rem 0.6rem;
  }

  .hint {
    margin-top: -0.3rem;
    font-size: 0.85rem;
    color: rgba(230, 236, 247, 0.8);
  }

  .avatar-field {
    display: grid;
    gap: 0.35rem;
  }

  .avatar-preview {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .avatar-preview img {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.45);
    box-shadow: 0 2px 14px rgba(0, 0, 0, 0.45);
  }

  .avatar-link {
    font-size: 0.85rem;
    overflow-wrap: anywhere;
  }

  .btn.big {
    font-size: 1.05rem;
    padding: 0.85rem 1.1rem;
    margin-top: 0.25rem;
    border-radius: 999px;
    border: 1px solid rgba(74, 141, 74, 0.9);
    background: rgba(74, 141, 74, 0.8);
    color: #f6fff6;
    font-weight: 600;
  }

  .btn.big[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .info {
    color: #ffd27f;
    font-size: 0.95rem;
    margin-top: 0.25rem;
  }

  .error {
    color: #ff9b9b;
    font-size: 0.95rem;
    margin-top: 0.25rem;
  }

  .link-button {
    display: inline;
    background: none;
    border: none;
    padding: 0;
    color: rgba(255, 230, 150, 0.9);
    text-decoration: underline;
    cursor: pointer;
    font-weight: 500;
  }

  .link-button:hover {
    color: rgba(255, 240, 180, 1);
  }

  .login-hint {
    margin-top: 0.75rem;
    text-align: center;
  }
</style>
