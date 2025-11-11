<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import Topbar from '../components/common/Topbar.svelte';
  import Footbar from '../components/common/Footbar.svelte';
  import BackgroundLayer from '../components/common/BackgroundLayer.svelte';
  import { t } from '../lib/i18n.js';
  import {
    fetchCurrentUserProfile,
    updateUserProfile,
    changeUserEmail,
    changeUserPassword,
    deleteCurrentUser
  } from '../lib/auth.js';
  import {
    AVAILABLE_AVATARS,
    MAX_AVATAR_SIZE,
    ACCEPTED_AVATAR_TYPES,
    ACCEPTED_AVATAR_STRING,
    DEFAULT_AVATAR
  } from '../lib/avatars.js';
  import { get } from 'svelte/store';
import Card from '../components/ui/Card.svelte';
import Button from '../components/ui/Button.svelte';
import InputField from '../components/ui/InputField.svelte';
import Modal from '../components/ui/Modal.svelte';
import NavActions from '../components/ui/NavActions.svelte';
import AlertPopup from '../components/ui/AlertPopup.svelte';
import { NAV_INTENT } from '../lib/navigation.js';

  const passwordRules = {
    minLength: 10,
    uppercase: /[A-Z]/,
    lowercase: /[a-z]/,
    number: /[0-9]/,
    symbol: /[^A-Za-z0-9]/
  };

  const dispatch = createEventDispatcher();

  export let user = null;
  export let showSessionIndicator = false;
  export let sessionIndicator = null;

  const translate = (key, vars) => get(t)(key, vars);

  let name = '';
  let alias = '';
  let email = '';
  let status = 'inactive';
  let inactiveReason = null;
  let avatarURL = DEFAULT_AVATAR;
  let avatarModalOpen = false;
  let pendingAvatar = DEFAULT_AVATAR;
  let customAvatarData = '';
  let customAvatarError = '';

  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';

  let deleteModalOpen = false;
  let deleteConfirmation = '';
  let deletePassword = '';
  let deleteError = '';
  let deleteLoading = false;

let loading = false;
let info = '';
let error = '';
let alertOpen = false;
let alertMessage = '';
let alertVariant = 'info';
let alertTitle = '';

const resetMessages = () => {
  info = '';
  error = '';
  alertMessage = '';
};

function openAlert(message, variant = 'info', title = null) {
  alertMessage = message;
  alertVariant = variant;
  alertTitle = title ?? translate('profile.title');
  alertOpen = true;
}

function closeAlert() {
  alertOpen = false;
}

  function setAvatarState(url) {
    const normalized = url || DEFAULT_AVATAR;
    avatarURL = normalized;
    pendingAvatar = normalized;
    customAvatarData = normalized?.startsWith('data:image') ? normalized : '';
    customAvatarError = '';
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

  async function loadProfile() {
    const profile = user ?? (await fetchCurrentUserProfile());
    if (!profile) return;
    user = profile;
    name = profile.name ?? '';
    alias = profile.alias ?? '';
    email = profile.email ?? '';
    status = profile.status ?? 'inactive';
    inactiveReason = profile.inactiveReason ?? null;
    setAvatarState(profile.avatarURL);
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
    const normalizedAvatar = avatarURL || DEFAULT_AVATAR;
    const originalAvatar = (user?.avatarURL ?? '') || DEFAULT_AVATAR;
    const avatarChanged = normalizedAvatar !== originalAvatar;

    const originalEmail = (user?.email ?? '').toLowerCase();
    const emailChanged = trimmedEmail && trimmedEmail !== originalEmail;
    const passwordChanged = newPassword.length > 0 || confirmPassword.length > 0;
    const hasProfileChanges =
      trimmedName !== (user?.name ?? '') ||
      trimmedAlias !== (user?.alias ?? '') ||
      avatarChanged ||
      emailChanged ||
      passwordChanged;

    if (!hasProfileChanges) {
      const msg = translate('profile.success.no_changes');
      info = msg;
      openAlert(msg, 'info');
      return;
    }

    if (passwordChanged) {
      if (!newPassword) {
        error = translate('profile.errors.password_required');
        openAlert(error, 'warning');
        return;
      }
      if (newPassword !== confirmPassword) {
        error = translate('profile.errors.password_mismatch');
        openAlert(error, 'warning');
        return;
      }
      if (!meetsPasswordRequirements(newPassword)) {
        error = translate('profile.errors.password_strength');
        openAlert(error, 'warning');
        return;
      }
    }

    const requiresReauth = passwordChanged;
    if (requiresReauth && !currentPassword) {
      error = translate('profile.errors.missing_current_password');
      openAlert(error, 'warning');
      return;
    }

    loading = true;
    try {
      if (passwordChanged) {
        await changeUserPassword(currentPassword, newPassword);
      }

      const profilePayload = {};
      if (trimmedName !== (user?.name ?? '')) {
        profilePayload.name = trimmedName;
      }
      if (trimmedAlias !== (user?.alias ?? '')) {
        profilePayload.alias = trimmedAlias;
      }
      if (avatarChanged) {
        profilePayload.avatarURL = normalizedAvatar;
      }

      if (Object.keys(profilePayload).length > 0) {
        await updateUserProfile(profilePayload);
      }

      if (!emailChanged) {
        const refreshed = await fetchCurrentUserProfile();
        status = refreshed?.status ?? status;
        inactiveReason = refreshed?.inactiveReason ?? inactiveReason;
        if (refreshed) {
          user = refreshed;
          setAvatarState(refreshed.avatarURL);
        }
        const successMsg = passwordChanged
          ? translate('profile.success.password_updated')
          : translate('profile.success.profile_updated');
        info = successMsg;
        openAlert(successMsg, 'info');
        currentPassword = '';
        newPassword = '';
        confirmPassword = '';
        dispatch('updated', { user: refreshed });
        return;
      }

      await changeUserEmail(currentPassword, trimmedEmail);
      status = 'inactive';
      inactiveReason = 'pending_verification';
      user = {
        ...(user ?? {}),
        email: trimmedEmail,
        status,
        inactiveReason,
        avatarURL: normalizedAvatar
      };
      const emailMsg = translate('profile.success.email_verification_sent', { email: trimmedEmail });
      info = emailMsg;
      openAlert(emailMsg, 'info');
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
      openAlert(error, 'error');
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

  function openAvatarModal() {
    pendingAvatar = avatarURL || DEFAULT_AVATAR;
    customAvatarError = '';
    if (avatarURL?.startsWith('data:image')) {
      customAvatarData = avatarURL;
    }
    avatarModalOpen = true;
  }

  function handleNavIntent(event) {
    const intent = event?.detail?.intent;
    if (intent === NAV_INTENT.BACK_TO_DASHBOARD) {
      goBack();
    }
  }

  function closeAvatarModal() {
    avatarModalOpen = false;
    customAvatarError = '';
    pendingAvatar = avatarURL || DEFAULT_AVATAR;
  }

  function selectPendingAvatar(url) {
    pendingAvatar = url;
  }

  function handleCustomAvatarChange(event) {
    customAvatarError = '';
    const file = event?.currentTarget?.files?.[0];
    if (!file) return;
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type) || file.size > MAX_AVATAR_SIZE) {
      customAvatarError = translate('profile.errors.custom_avatar_invalid');
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
      customAvatarError = translate('profile.errors.custom_avatar_invalid');
    };
    reader.readAsDataURL(file);
  }

  function confirmAvatarSelection() {
    avatarURL = pendingAvatar || DEFAULT_AVATAR;
    avatarModalOpen = false;
    if (avatarURL?.startsWith('data:image')) {
      customAvatarData = avatarURL;
    } else {
      customAvatarData = '';
    }
  }

  function openDeleteModal() {
    deleteConfirmation = '';
    deletePassword = '';
    deleteError = '';
    deleteModalOpen = true;
  }

  function closeDeleteModal() {
    deleteModalOpen = false;
    deleteLoading = false;
  }

  $: deletionCode = $t('profile.delete.confirm_code');
  $: deletionMatches =
    deleteConfirmation.trim().toLowerCase() === deletionCode?.trim().toLowerCase();

  async function confirmDeleteAccount() {
    deleteError = '';
    if (!deletionMatches) {
      deleteError = translate('profile.delete.errors.code_mismatch', { code: deletionCode });
      openAlert(deleteError, 'warning', translate('profile.delete.title'));
      return;
    }
    if (!deletePassword) {
      deleteError = translate('profile.delete.errors.missing_password');
      openAlert(deleteError, 'warning', translate('profile.delete.title'));
      return;
    }
    deleteLoading = true;
    try {
      await deleteCurrentUser(deletePassword);
      info = translate('profile.delete.success');
      openAlert(info, 'info', translate('profile.delete.title'));
      deleteModalOpen = false;
      dispatch('deleted');
    } catch (err) {
      console.error('[profile.delete]', err);
      const code = err?.code ?? '';
      if (code === 'auth/wrong-password') {
        deleteError = translate('profile.errors.invalid_current_password');
      } else if (code === 'auth/requires-recent-login') {
        deleteError = translate('profile.delete.errors.requires_recent_login');
      } else {
        deleteError = translate('profile.delete.errors.generic');
      }
      openAlert(deleteError, 'error', translate('profile.delete.title'));
    } finally {
      deleteLoading = false;
      deletePassword = '';
    }
  }
</script>

<BackgroundLayer />

<div class="page-grid profile-screen">
  <Topbar
    titleKey="profile.title"
    user={user}
    showSessionIndicator={showSessionIndicator}
    sessionIndicator={sessionIndicator}
    on:profile={relay}
    on:logout={relay}
  />

  <main class="page-main">
    <form class="profile-card surface-panel" on:submit|preventDefault={onSubmit} aria-label={$t('profile.title')}>
      <header class="profile-header">
        <div>
          <h2 class="panel-title">{$t('profile.title')}</h2>
          <p class="panel-subtitle">{$t('profile.intro')}</p>
        </div>
      </header>
      <div class="form-stack">

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

      <div class="field avatar-field">
        <span class="label">
          {$t('profile.avatar_label')}
          <small>({$t('profile.optional')})</small>
        </span>
        <div class="current-avatar">
          <img src={avatarURL} alt={$t('profile.avatar_current_alt')} />
          <div class="current-avatar-actions">
            <span class="hint avatar-hint">{$t('profile.avatar_hint')}</span>
            <Button variant="secondary" type="button" on:click={openAvatarModal}>
              {$t('profile.avatar_change_button')}
            </Button>
          </div>
        </div>
        {#if customAvatarError}
          <p class="error" aria-live="assertive">{customAvatarError}</p>
        {/if}
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
          <small>({$t('profile.required_short')})</small>
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
        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? '…' : $t('profile.save')}
        </Button>
        <NavActions
          intents={[NAV_INTENT.BACK_TO_DASHBOARD]}
          on:navigate={handleNavIntent}
          className="nav-inline"
        />
      </div>

      </div>
    </form>

    <section class="danger-card surface-panel" aria-labelledby="danger-title">
      <header class="form-header">
        <h2 id="danger-title" class="panel-title">{$t('profile.delete.title')}</h2>
        <p class="panel-subtitle">{$t('profile.delete.description')}</p>
      </header>
      <p class="hint danger-note">{$t('profile.delete.playful_warning')}</p>
      <Button type="button" variant="danger" on:click={openDeleteModal}>
        {$t('profile.delete.button')}
      </Button>
    </section>
  </main>

  <Footbar />
</div>

<Modal
  open={avatarModalOpen}
  title={$t('profile.avatar_modal_title')}
  ariaLabel={$t('profile.avatar_modal_help')}
  showClose={false}
  closeOnBackdrop={false}
  on:close={closeAvatarModal}
>
  <p class="modal-hint">{$t('profile.avatar_modal_help')}</p>

  <div class="avatar-options modal-grid">
    {#each AVAILABLE_AVATARS as avatar}
      <button
        type="button"
        class={`avatar-option ${pendingAvatar === avatar.value ? 'selected' : ''}`}
        on:click={() => selectPendingAvatar(avatar.value)}
        aria-pressed={pendingAvatar === avatar.value}
      >
        <img src={avatar.value} alt={$t(avatar.labelKey)} />
        <span class="hint avatar-option-label">{$t(avatar.labelKey)}</span>
      </button>
    {/each}
  </div>

  <div class="custom-upload">
    <label class="custom-upload-label">
      {$t('profile.avatar_custom_label')}
      <input type="file" accept={ACCEPTED_AVATAR_STRING} on:change={handleCustomAvatarChange} />
    </label>
    <small class="hint">{$t('profile.avatar_custom_hint')}</small>
    {#if customAvatarError}
      <p class="error" aria-live="assertive">{customAvatarError}</p>
    {/if}
    {#if customAvatarData}
      <div class="custom-preview">
        <img src={customAvatarData} alt={$t('profile.avatar_custom_preview_alt')} />
        <Button
          variant="secondary"
          type="button"
          className={pendingAvatar === customAvatarData ? 'selected' : ''}
          on:click={() => selectPendingAvatar(customAvatarData)}
        >
          {$t('profile.avatar_use_custom')}
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

<Modal
  open={deleteModalOpen}
  showClose={false}
  title={$t('profile.delete.modal_title')}
  ariaLabel={$t('profile.delete.modal_hint')}
  closeOnBackdrop={false}
  on:close={closeDeleteModal}
>
  <p class="modal-hint">{$t('profile.delete.modal_hint')}</p>
  <p class="modal-warning">{$t('profile.delete.modal_warning')}</p>

  <div class="field">
    <label class="label" for="delete-confirm">
      {$t('profile.delete.confirm_label', { code: deletionCode })}
    </label>
    <input
      id="delete-confirm"
      class="input"
      type="text"
      bind:value={deleteConfirmation}
      placeholder={$t('profile.delete.confirm_placeholder', { code: deletionCode })}
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck={false}
    />
  </div>

  <div class="field">
    <label class="label" for="delete-password">{$t('profile.delete.password_label')}</label>
    <input
      id="delete-password"
      class="input"
      type="password"
      bind:value={deletePassword}
      autocomplete="current-password"
      placeholder={$t('profile.delete.password_placeholder')}
    />
  </div>

  {#if deleteError}
    <p class="error" aria-live="assertive">{deleteError}</p>
  {/if}

  <svelte:fragment slot="footer">
    <Button variant="ghost" on:click={closeDeleteModal} disabled={deleteLoading}>
      {$t('common.actions.cancel')}
    </Button>
    <Button variant="danger" on:click={confirmDeleteAccount} disabled={!deletionMatches || deleteLoading}>
      {deleteLoading ? '…' : $t('profile.delete.confirm_button')}
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

<style>
  .profile-card {
    width: min(520px, 92vw);
    margin: 0 auto;
    gap: var(--space-4);
  }

  .danger-card {
    width: min(520px, 92vw);
    margin: var(--space-5) auto 0;
    gap: var(--space-3);
    display: flex;
    flex-direction: column;
  }

  .profile-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-3);
    align-items: center;
  }

  .avatar-hint {
    display: block;
  }

  .profile-card .field {
    display: grid;
    gap: 0.5rem;
  }

  .hint {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  .avatar-field {
    gap: var(--space-2);
  }

  .current-avatar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .current-avatar img {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.35);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
  }

  .current-avatar-actions {
    display: grid;
    gap: 0.3rem;
  }

  .divider {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    margin: var(--space-3) 0;
  }

  .section-title {
    margin: 0;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
    align-items: center;
  }

  .danger-note {
    margin: 0;
    color: #ffbeb8;
  }

  .modal-warning {
    color: #ffbeb8;
    font-size: 0.95rem;
  }

  .modal-hint {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  .avatar-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: var(--space-3);
  }

  .avatar-option {
    display: grid;
    gap: 0.3rem;
    justify-items: center;
    padding: 0.75rem 0.5rem;
    border-radius: var(--radius-md);
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.02);
  }

  .avatar-option.selected {
    border-color: rgba(244, 212, 124, 0.85);
    box-shadow: 0 12px 24px rgba(244, 212, 124, 0.2);
  }

  .avatar-option img {
    width: 64px;
    height: 64px;
    border-radius: 50%;
  }

  .avatar-option-label {
    text-align: center;
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
    padding: 0.65rem 0.8rem;
    border-radius: var(--radius-md);
    border: 1px dashed rgba(255, 255, 255, 0.25);
    color: var(--color-text-secondary);
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
</style>
