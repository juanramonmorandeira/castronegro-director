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

  const resetMessages = () => {
    info = '';
    error = '';
  };

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
      status = 'inactive';
      inactiveReason = 'pending_verification';
      user = {
        ...(user ?? {}),
        email: trimmedEmail,
        status,
        inactiveReason,
        avatarURL: normalizedAvatar
      };
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

  function openAvatarModal() {
    pendingAvatar = avatarURL || DEFAULT_AVATAR;
    customAvatarError = '';
    if (avatarURL?.startsWith('data:image')) {
      customAvatarData = avatarURL;
    }
    avatarModalOpen = true;
  }

  function closeAvatarModal() {
    avatarModalOpen = false;
    customAvatarError = '';
    pendingAvatar = avatarURL || DEFAULT_AVATAR;
  }

  function handleAvatarBackdropKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAvatarModal();
    }
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

  function handleDeleteBackdropKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDeleteModal();
    }
  }

  $: deletionCode = $t('profile.delete.confirm_code');
  $: deletionMatches =
    deleteConfirmation.trim().toLowerCase() === deletionCode?.trim().toLowerCase();

  async function confirmDeleteAccount() {
    deleteError = '';
    if (!deletionMatches) {
      deleteError = translate('profile.delete.errors.code_mismatch', {
        code: deletionCode
      });
      return;
    }
    if (!deletePassword) {
      deleteError = translate('profile.delete.errors.missing_password');
      return;
    }
    deleteLoading = true;
    try {
      await deleteCurrentUser(deletePassword);
      info = translate('profile.delete.success');
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
    } finally {
      deleteLoading = false;
      deletePassword = '';
    }
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
        {#if status !== 'active' && inactiveReason === 'pending_verification'}
          <small class="status-hint">{$t('profile.status.pending_verification')}</small>
        {/if}
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

      <div class="field avatar-field">
        <span class="label">
          {$t('profile.avatar_label')}
          <small>({$t('profile.optional')})</small>
        </span>
        <div class="current-avatar">
          <img src={avatarURL} alt={$t('profile.avatar_current_alt')} />
          <div class="current-avatar-actions">
            <span class="hint">{$t('profile.avatar_hint')}</span>
            <button type="button" class="btn outline" on:click={openAvatarModal}>
              {$t('profile.avatar_change_button')}
            </button>
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

      <div class="danger-zone">
        <h3>{$t('profile.delete.title')}</h3>
        <p>{$t('profile.delete.description')}</p>
        <p class="danger-note">{$t('profile.delete.playful_warning')}</p>
        <button type="button" class="btn danger" on:click={openDeleteModal}>
          {$t('profile.delete.button')}
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

{#if avatarModalOpen}
  <button
    type="button"
    class="modal-backdrop"
    aria-label={$t('common.actions.cancel')}
    on:click={closeAvatarModal}
    on:keydown={handleAvatarBackdropKeydown}
  ></button>
  <div
    class="modal avatar-modal"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="avatarModalTitle"
    aria-describedby="avatarModalHelp"
  >
    <div class="modal-content avatar-modal-content">
      <h3 id="avatarModalTitle">{$t('profile.avatar_modal_title')}</h3>
      <p id="avatarModalHelp" class="modal-hint">{$t('profile.avatar_modal_help')}</p>

      <div class="avatar-options modal-grid">
        {#each AVAILABLE_AVATARS as avatar}
          <button
            type="button"
            class="avatar-option"
            class:selected={pendingAvatar === avatar.value}
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
            <button
              type="button"
              class="btn outline"
              class:selected={pendingAvatar === customAvatarData}
              on:click={() => selectPendingAvatar(customAvatarData)}
            >
              {$t('profile.avatar_use_custom')}
            </button>
          </div>
        {/if}
      </div>

      <div class="modal-actions">
        <button type="button" class="btn outline" on:click={closeAvatarModal}>
          {$t('common.actions.cancel')}
        </button>
        <button type="button" class="btn primary" on:click={confirmAvatarSelection}>
          {$t('profile.avatar_save_selection')}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if deleteModalOpen}
  <button
    type="button"
    class="modal-backdrop"
    aria-label={$t('common.actions.cancel')}
    on:click={closeDeleteModal}
    on:keydown={handleDeleteBackdropKeydown}
  ></button>
  <div
    class="modal delete-modal"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="deleteModalTitle"
    aria-describedby="deleteModalDescription"
  >
    <div class="modal-content">
      <h3 id="deleteModalTitle">{$t('profile.delete.modal_title')}</h3>
      <p id="deleteModalDescription" class="modal-hint">{$t('profile.delete.modal_hint')}</p>
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

      <div class="modal-actions">
        <button type="button" class="btn outline" on:click={closeDeleteModal} disabled={deleteLoading}>
          {$t('common.actions.cancel')}
        </button>
        <button
          type="button"
          class="btn danger"
          on:click={confirmDeleteAccount}
          disabled={!deletionMatches || deleteLoading}
        >
          {deleteLoading ? '…' : $t('profile.delete.confirm_button')}
        </button>
      </div>
    </div>
  </div>
{/if}

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
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
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

  .status-hint {
    margin: 0;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.75);
    text-align: center;
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

  .danger-zone {
    margin-top: 1.5rem;
    padding: 1rem;
    border: 1px solid rgba(255, 120, 120, 0.4);
    border-radius: 1rem;
    background: rgba(70, 20, 20, 0.35);
    display: grid;
    gap: 0.75rem;
  }

  .danger-zone h3 {
    margin: 0;
    font-size: 1.1rem;
    color: rgba(255, 180, 180, 0.95);
  }

  .danger-zone p {
    margin: 0;
    color: rgba(255, 215, 215, 0.85);
    font-size: 0.9rem;
  }

  .danger-note {
    font-style: italic;
    color: rgba(255, 200, 200, 0.85);
  }

  .btn.danger {
    background: rgba(200, 60, 60, 0.85);
    border: 1px solid rgba(210, 70, 70, 0.95);
    color: #fff1f1;
  }

  .btn.danger[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn.outline {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.4);
    color: #f0f4f9;
    padding: 0.55rem 1.2rem;
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  .btn.outline:hover,
  .btn.outline:focus-visible {
    border-color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.08);
  }

  .avatar-field {
    gap: 0.75rem;
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

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
    z-index: 80;
    border: 0;
    padding: 0;
    cursor: pointer;
  }

  .modal-backdrop:focus-visible {
    outline: 2px solid rgba(255, 232, 140, 0.7);
  }

  .modal {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 2rem 1rem;
    z-index: 90;
  }

  .modal.delete-modal {
    z-index: 95;
  }

  .avatar-modal {
    z-index: 90;
  }

  .modal-content {
    width: min(480px, 95vw);
    display: grid;
    gap: 1rem;
    padding: 1.75rem;
    border-radius: 1.2rem;
    background: rgba(20, 18, 28, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 18px 45px rgba(0, 0, 0, 0.55);
  }

  .avatar-modal .modal-content {
    border-color: rgba(255, 232, 140, 0.3);
  }

  .delete-modal .modal-content {
    border-color: rgba(255, 120, 120, 0.3);
  }

  .modal-content h3 {
    margin: 0;
    font-size: 1.3rem;
    color: #f3f5f7;
  }

  .delete-modal .modal-content h3 {
    color: rgba(255, 190, 190, 0.95);
  }

  .modal-hint,
  .modal-warning {
    margin: 0;
    font-size: 0.95rem;
    color: rgba(245, 245, 245, 0.8);
  }

  .delete-modal .modal-hint {
    color: rgba(255, 230, 230, 0.85);
  }

  .modal-warning {
    font-weight: 600;
    color: rgba(255, 180, 180, 0.95);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    flex-wrap: wrap;
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

  .avatar-option.selected {
    border-color: rgba(255, 232, 140, 0.9);
    box-shadow: 0 4px 16px rgba(255, 232, 140, 0.22);
    transform: translateY(-2px);
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

  .avatar-option:focus-visible {
    outline: 2px solid rgba(255, 232, 140, 0.7);
    outline-offset: 3px;
  }

  .custom-upload {
    display: grid;
    gap: 0.5rem;
  }

  .custom-upload-label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    color: rgba(245, 245, 245, 0.85);
  }

  .custom-upload-label input {
    display: none;
  }

  .custom-preview {
    display: grid;
    gap: 0.5rem;
    justify-items: center;
  }

  .custom-preview img {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.45);
    box-shadow: 0 2px 14px rgba(0, 0, 0, 0.45);
  }
</style>
