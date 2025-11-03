<script>
  import Topbar from './Topbar.svelte';
  import Footbar from './Footbar.svelte';
  import BackgroundLayer from './landing/BackgroundLayer.svelte';
  import { t } from '../lib/i18n.js';
  import { createEventDispatcher } from 'svelte';
  import { loginWithEmail, sendPasswordResetIfExists } from '../lib/auth.js';

  export let onLoginSuccess = null;
  export let onLoginForgot = null;

  const dispatch = createEventDispatcher();
  let email = '';
  let password = '';
  let loginPending = false;
  let forgotPending = false;
  let feedback = '';
  let feedbackKind = 'info';
  let role = 'storyteller';

  function goRegistration() {
    dispatch('navigate-registration');
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const resetFeedback = () => {
    feedback = '';
    feedbackKind = 'info';
  };

  async function onSubmit(event) {
    event.preventDefault();
    resetFeedback();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      feedback = $t('login.form.errors.missing_email');
      feedbackKind = 'error';
      return;
    }
    if (!emailPattern.test(trimmedEmail)) {
      feedback = $t('login.form.errors.invalid_email');
      feedbackKind = 'error';
      return;
    }
    if (!password) {
      feedback = $t('login.form.errors.missing_password');
      feedbackKind = 'error';
      return;
    }

    loginPending = true;
    try {
      await loginWithEmail(trimmedEmail, password);
      const detail = { email: trimmedEmail, role };
      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(detail);
      }
      dispatch('loginSuccess', detail);
      password = '';
    } catch (error) {
      console.error('Login error', error);
      feedbackKind = 'error';
      const code = error?.code ?? '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        feedback = $t('login.form.errors.invalid_credentials');
      } else if (code === 'auth/user-disabled') {
        feedback = $t('login.form.errors.account_disabled');
      } else if (code === 'auth/too-many-requests') {
        feedback = $t('login.form.errors.too_many_attempts');
      } else {
        feedback = $t('login.form.errors.generic');
      }
    } finally {
      loginPending = false;
    }
  }

  async function onForgot(event) {
    event.preventDefault();
    resetFeedback();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      feedback = $t('login.form.errors.missing_email');
      feedbackKind = 'error';
      return;
    }
    if (!emailPattern.test(trimmedEmail)) {
      feedback = $t('login.form.errors.invalid_email');
      feedbackKind = 'error';
      return;
    }

    forgotPending = true;
    try {
      await sendPasswordResetIfExists(trimmedEmail);
      feedback = $t('login.form.success.reset_link_sent');
      feedbackKind = 'info';
      const detail = { email: trimmedEmail };
      if (typeof onLoginForgot === 'function') {
        onLoginForgot(detail);
      }
      dispatch('loginForgot', detail);
    } catch (error) {
      console.error('Password reset error', error);
      // No exponemos si el correo existe: respuesta genérica
      feedback = $t('login.form.success.reset_link_sent');
      feedbackKind = 'info';
    } finally {
      forgotPending = false;
    }
  }

  $: formSectionLabel = $t('login.form.section_label');
  $: emailLabel = $t('login.form.email_label');
  $: emailPlaceholder = $t('login.form.email_placeholder');
  $: passwordLabel = $t('login.form.password_label');
  $: passwordPlaceholder = $t('login.form.password_placeholder');
  $: submitLabel = $t('login.form.submit');
  $: forgotLabel = $t('login.form.forgot');
  $: roleLabel = $t('login.form.role_label');
  $: storytellerLabel = $t('login.form.roles.storyteller');
  $: playerLabel = $t('login.form.roles.player');
  $: registerPrompt = $t('login.form.register_prompt');
  $: registerLink = $t('login.form.register_link');
  $: submitDisplay = loginPending ? `${submitLabel}…` : submitLabel;
  $: forgotDisplay = forgotPending ? `${forgotLabel}…` : forgotLabel;
  $: emailInvalid = feedbackKind === 'error' && (!email.trim() || !emailPattern.test(email.trim()));
  $: messageRole = feedbackKind === 'error' ? 'alert' : 'status';
</script>

<BackgroundLayer />

  <div class="page">
  <Topbar titleKey="login.title" />

  <main class="center">
    <h1 class="sr-only">{$t('login.title')}</h1>

    <div class="auth-layout">
      <form
        class="auth-card card-glass"
        aria-label={formSectionLabel}
        on:submit|preventDefault={onSubmit}
        novalidate
      >
        <h2>{formSectionLabel}</h2>

        <div class="field">
          <label class="label" for="email">{emailLabel}</label>
          <input
            id="email"
            class="input"
            type="email"
            name="email"
            bind:value={email}
            autocomplete="email"
            inputmode="email"
            placeholder={emailPlaceholder}
            aria-required="true"
            aria-invalid={emailInvalid}
          />
        </div>

        <div class="field">
          <label class="label" for="password">{passwordLabel}</label>
          <input
            id="password"
            class="input"
            type="password"
            name="password"
            bind:value={password}
            autocomplete="current-password"
            placeholder={passwordPlaceholder}
            aria-required="true"
          />
        </div>

        {#if feedback}
          <p class="message" class:error={feedbackKind === 'error'} class:info={feedbackKind === 'info'} role={messageRole} aria-live="polite">
            {feedback}
          </p>
        {/if}

        <fieldset class="field">
          <legend class="label">{roleLabel}</legend>
          <div class="role-options">
            <label class="role-option">
              <input
                type="radio"
                name="role"
                value="storyteller"
                bind:group={role}
              />
              <span>{storytellerLabel}</span>
            </label>
            <label class="role-option">
              <input
                type="radio"
                name="role"
                value="player"
                bind:group={role}
              />
              <span>{playerLabel}</span>
            </label>
          </div>
        </fieldset>

        <div class="form-actions">
          <button
            class="btn primary"
            type="submit"
            disabled={loginPending}
            aria-disabled={loginPending}
          >
            {submitDisplay}
          </button>
          <button
            class="link-button"
            type="button"
            on:click={onForgot}
            disabled={forgotPending}
            aria-disabled={forgotPending}
          >
            {forgotDisplay}
          </button>
        </div>

        <p class="register-hint">
          {registerPrompt}
          <button type="button" class="link-button" on:click={goRegistration}>
            {registerLink}
          </button>
        </p>
      </form>
    </div>
  </main>

  <Footbar />
</div>

<style>
  .page {
    position: relative;
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

  .field {
    display: grid;
    gap: 0.35rem;
  }

  .label {
    font-weight: 600;
    color: #f0f2f4;
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

  .form-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  fieldset.field {
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 12px;
    padding: 1rem;
    text-align: center;
    display: grid;
    gap: 0.75rem;
  }

  fieldset.field legend {
    padding: 0 0.5rem;
  }

  .role-options {
    display: flex;
    justify-content: center;
    gap: 1.25rem;
    flex-wrap: wrap;
  }

  .role-option {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.95rem;
    color: #f0f4f9;
  }

  .role-option input {
    accent-color: rgba(255, 232, 140, 0.8);
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
    backdrop-filter: none;
    box-shadow: none;
  }

  .link-button[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .link-button:hover {
    color: rgba(255, 240, 180, 1);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  .message {
    margin: 0.25rem 0 0;
    font-size: 0.95rem;
  }

  .message.error {
    color: #ffc9c9;
  }

  .message.info {
    color: #d7f6ff;
  }

  .register-hint {
    margin: 0.75rem 0 0;
    font-size: 0.95rem;
    color: #f0f3f7;
    text-align: center;
  }

  .register-hint .link-button {
    margin-left: 0.4rem;
  }
</style>
