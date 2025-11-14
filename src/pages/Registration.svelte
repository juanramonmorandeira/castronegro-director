<script>
  import Topbar from '../components/common/Topbar.svelte';
  import Footbar from '../components/common/Footbar.svelte';
  import BackgroundLayer from '../components/common/BackgroundLayer.svelte';
  import { t } from '../lib/i18n.js';
  import { registerWithEmail, sendVerificationEmail } from '../lib/auth.js';
  import {
    AVAILABLE_AVATARS,
    MAX_AVATAR_SIZE,
    ACCEPTED_AVATAR_TYPES,
    ACCEPTED_AVATAR_STRING,
    DEFAULT_AVATAR
  } from '../lib/avatars.js';
  import { createEventDispatcher } from 'svelte';
  import Card from '../components/ui/Card.svelte';
  import Button from '../components/ui/Button.svelte';
  import InputField from '../components/ui/InputField.svelte';
  import Modal from '../components/ui/Modal.svelte';
  import NavActions from '../components/ui/NavActions.svelte';
  import AlertPopup from '../components/ui/AlertPopup.svelte';
  import { NAV_INTENT } from '../lib/navigation.js';
  import { isValidEmail, PASSWORD_RULES, meetsPasswordRequirements } from '../lib/utils/validators.js';

  const dispatch = createEventDispatcher();

  export let showSessionIndicator = false;
  export let sessionIndicator = null;

  let name = '';
  let alias = '';
  let email = '';
  let password = '';
  let confirmPassword = '';

  let avatarURL = DEFAULT_AVATAR;
  let avatarModalOpen = false;
  let pendingAvatar = avatarURL;
  let customAvatarData = '';
  let customAvatarError = '';

  let loading = false;
  let info = '';
  let error = '';
  let alertOpen = false;
  let alertMessage = '';
  let alertVariant = 'warning';
  let alertTitle = '';

  $: namePlaceholder = $t('registration.name_placeholder');
  $: aliasPlaceholder = $t('registration.alias_placeholder');
  $: emailPlaceholder = $t('registration.email_placeholder');
  $: passwordPlaceholder = $t('registration.password_placeholder');
  $: confirmPasswordPlaceholder = $t('registration.confirm_password_placeholder');
  $: defaultAlertTitle = $t('registration.alert_title');

  function resetFeedback() {
    info = '';
    error = '';
  }

  function openAvatarModal() {
    pendingAvatar = avatarURL;
    customAvatarError = '';
    if (avatarURL?.startsWith('data:image')) {
      customAvatarData = avatarURL;
    }
    avatarModalOpen = true;
  }

  function closeAvatarModal() {
    avatarModalOpen = false;
    pendingAvatar = avatarURL;
    customAvatarError = '';
  }

  function selectPendingAvatar(url) {
    pendingAvatar = url;
  }

  function handleCustomAvatarChange(event) {
    customAvatarError = '';
    const file = event?.currentTarget?.files?.[0];
    if (!file) return;
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type) || file.size > MAX_AVATAR_SIZE) {
      customAvatarError = $t('registration.errors.custom_avatar_invalid');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        customAvatarData = result;
        pendingAvatar = result;
      }
    };
    reader.onerror = () => {
      customAvatarError = $t('registration.errors.custom_avatar_invalid');
    };
    reader.readAsDataURL(file);
  }

  function confirmAvatarSelection() {
    avatarURL = pendingAvatar;
    avatarModalOpen = false;
    if (avatarURL?.startsWith('data:image')) {
      customAvatarData = avatarURL;
    } else if (!avatarURL) {
      customAvatarData = '';
    }
  }

  function handleNavIntent(event) {
    const intent = event?.detail?.intent;
    if (intent === NAV_INTENT.BACK_TO_LOGIN) {
      goLogin();
    }
  }

  function openAlert(message, variant = 'warning', title = defaultAlertTitle) {
    alertMessage = message;
    alertVariant = variant;
    alertTitle = title;
    alertOpen = true;
  }

  function closeAlert() {
    alertOpen = false;
  }

  async function onSubmit() {
    resetFeedback();

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedAlias = alias.trim();

    if (!trimmedName) {
      error = $t('registration.errors.missing_name');
      openAlert(error);
      return;
    }

    if (!normalizedEmail) {
      error = $t('registration.errors.missing_email');
      openAlert(error);
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      error = $t('registration.errors.invalid_email');
      openAlert(error);
      return;
    }

    if (!password) {
      error = $t('registration.errors.missing_password');
      openAlert(error);
      return;
    }

    if (!confirmPassword) {
      error = $t('registration.errors.missing_confirm');
      openAlert(error);
      return;
    }

    if (password !== confirmPassword) {
      error = $t('registration.errors.password_mismatch');
      openAlert(error);
      return;
    }

    if (!meetsPasswordRequirements(password)) {
      error = $t('registration.errors.password_strength');
      openAlert(error);
      return;
    }

    loading = true;
    try {
      const user = await registerWithEmail(normalizedEmail, password, {
        name: trimmedName,
        alias: trimmedAlias,
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
      openAlert(error, 'error');
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
  <Topbar
    titleKey="registration.title"
    showUserMenu={false}
    showSessionIndicator={showSessionIndicator}
    sessionIndicator={sessionIndicator}
  />

  <main class="auth-screen">
    <div class="auth-layout">
      <Card className="auth-card">
        <form class="auth-form" on:submit|preventDefault={onSubmit} novalidate aria-label={$t('registration.title')}>
          <div class="form-header">
            <h2 class="panel-title">{$t('registration.title')}</h2>
            <p class="panel-subtitle">{$t('registration.intro')}</p>
          </div>

        <InputField
          id="name"
          name="name"
          label={$t('registration.name_label')}
          type="text"
          bind:value={name}
          required={true}
          autocomplete="name"
          placeholder={namePlaceholder}
        />

        <InputField
          id="alias"
          name="alias"
          label={`${$t('registration.alias_label')} (${$t('registration.optional')})`}
          type="text"
          bind:value={alias}
          autocomplete="nickname"
          placeholder={aliasPlaceholder}
        />

          <div class="field avatar-field">
            <span class="label">
              {$t('registration.avatar_label')}
              <small>({$t('registration.optional')})</small>
            </span>
            <div class="current-avatar">
              <img src={avatarURL} alt={$t('registration.avatar_selected_alt')} />
              <div class="current-avatar-actions">
                <span class="hint avatar-hint">{$t('registration.avatar_help')}</span>
                <Button variant="secondary" type="button" on:click={openAvatarModal}>
                  {$t('registration.avatar_change_button')}
                </Button>
              </div>
            </div>
          </div>

        <InputField
          id="email"
          name="email"
          label={$t('registration.email_label')}
          type="email"
          bind:value={email}
          required={true}
          autocomplete="email"
          placeholder={emailPlaceholder}
        />

        <InputField
          id="password"
          name="password"
          label={$t('registration.password_label')}
          type="password"
          bind:value={password}
          required={true}
          autocomplete="new-password"
          minlength={PASSWORD_RULES.minLength}
          placeholder={passwordPlaceholder}
          hint={$t('registration.password_requirements')}
        />

        <InputField
          id="confirm"
          name="confirm"
          label={$t('registration.confirm_password_label')}
          type="password"
          bind:value={confirmPassword}
          required={true}
          autocomplete="new-password"
          minlength={PASSWORD_RULES.minLength}
          placeholder={confirmPasswordPlaceholder}
        />

          <div class="form-actions cluster">
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? '…' : $t('registration.submit')}
            </Button>
            <NavActions
              intents={[NAV_INTENT.BACK_TO_LOGIN]}
              on:navigate={handleNavIntent}
              className="nav-inline"
            />
          </div>

        </form>
      </Card>
    </div>
  </main>

  <Footbar />

  <Modal
    open={avatarModalOpen}
    title={$t('registration.avatar_modal_title')}
    ariaLabel={$t('registration.avatar_modal_help')}
    closeOnBackdrop={false}
    on:close={closeAvatarModal}
  >
    <p class="modal-hint">{$t('registration.avatar_modal_help')}</p>

    <div class="avatar-options modal-grid">
      {#each AVAILABLE_AVATARS as avatar}
        <button
          type="button"
          class={`avatar-option ${pendingAvatar === avatar.value ? 'selected' : ''}`}
          on:click={() => selectPendingAvatar(avatar.value)}
          aria-pressed={pendingAvatar === avatar.value}
        >
          <img src={avatar.value} alt={$t(avatar.labelKey)} />
          <span>{$t(avatar.labelKey)}</span>
        </button>
      {/each}
    </div>

    <div class="custom-upload">
      <label class="custom-upload-label">
        {$t('registration.avatar_custom_label')}
        <input type="file" accept={ACCEPTED_AVATAR_STRING} on:change={handleCustomAvatarChange} />
      </label>
      <small class="hint">{$t('registration.avatar_custom_hint')}</small>
      {#if customAvatarError}
        <p class="error" aria-live="assertive">{customAvatarError}</p>
      {/if}
      {#if customAvatarData}
        <div class="custom-preview">
          <img src={customAvatarData} alt={$t('registration.avatar_custom_preview_alt')} />
          <Button
            variant="secondary"
            type="button"
            className={pendingAvatar === customAvatarData ? 'selected' : ''}
            on:click={() => selectPendingAvatar(customAvatarData)}
          >
            {$t('registration.avatar_use_custom')}
          </Button>
        </div>
      {/if}
    </div>

    <svelte:fragment slot="footer">
      <Button variant="ghost" on:click={closeAvatarModal}>
        {$t('common.actions.cancel')}
      </Button>
      <Button variant="primary" on:click={confirmAvatarSelection}>
        {$t('common.actions.save')}
      </Button>
    </svelte:fragment>
  </Modal>
  <AlertPopup
    open={alertOpen}
    title={alertTitle}
    message={alertMessage}
    variant={alertVariant}
    on:close={closeAlert}
  />
</div>

<style>
  .page {
    min-height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr auto;
  }

  :global(.auth-card) {
    text-align: left;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .hint {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  .avatar-hint {
    display: block;
  }

  .avatar-field {
    display: grid;
    gap: var(--space-2);
  }

  .current-avatar {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .current-avatar-actions {
    display: grid;
    gap: var(--space-2);
  }

  .current-avatar img {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.35);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  }

  .avatar-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: var(--space-3);
  }

  .avatar-option {
    display: grid;
    gap: 0.35rem;
    justify-items: center;
    padding: 0.75rem 0.5rem;
    border-radius: var(--radius-lg);
    border: 1px solid var(--glass-border-strong);
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-text-primary);
  }

  .avatar-option.selected {
    border-color: rgba(255, 232, 140, 0.85);
    box-shadow: 0 12px 30px rgba(255, 232, 140, 0.25);
  }

  .avatar-option img {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
  }

  .modal-hint {
    margin: 0;
    color: var(--color-text-muted);
  }

  .custom-upload {
    display: grid;
    gap: var(--space-2);
  }

  .custom-upload-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    padding: 0.6rem 0.8rem;
    border-radius: var(--radius-md);
    border: 1px dashed rgba(255, 255, 255, 0.3);
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .custom-upload-label input {
    display: none;
  }

  .custom-preview {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .custom-preview img {
    width: 72px;
    height: 72px;
    border-radius: 50%;
  }

  .info {
    color: var(--color-gold-highlight);
    margin: 0;
  }

  .error {
    color: var(--color-error-soft);
    margin: 0;
  }
</style>
