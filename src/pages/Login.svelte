<script>
  import Topbar from '../components/common/Topbar.svelte';
  import Footbar from '../components/common/Footbar.svelte';
  import BackgroundLayer from '../components/common/BackgroundLayer.svelte';
  import { t } from '../lib/i18n.js';
  import { createEventDispatcher } from 'svelte';
  import { loginWithEmail, sendPasswordResetIfExists } from '../lib/auth.js';
  import Card from '../components/ui/Card.svelte';
  import Button from '../components/ui/Button.svelte';
  import InputField from '../components/ui/InputField.svelte';
  import AlertPopup from '../components/ui/AlertPopup.svelte';

  export let onLoginSuccess = null;
  export let onLoginForgot = null;
  export let verificationNotice = null;
  export let showSessionIndicator = false;
  export let sessionIndicator = null;

  const dispatch = createEventDispatcher();
  let email = '';
  let password = '';
  let loginPending = false;
  let forgotPending = false;
  let feedback = '';
  let feedbackKind = 'info';
  let role = 'storyteller';
  let alertOpen = false;
  let alertMessage = '';
  let alertVariant = 'error';
  let lastNoticeKey = null;

  function goRegistration() {
    dispatch('navigate-registration');
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const resetFeedback = () => {
    feedback = '';
    feedbackKind = 'info';
  };

  function openAlert(message, variant = 'error') {
    alertMessage = message;
    alertVariant = variant;
    alertOpen = true;
  }

  function closeAlert() {
    alertOpen = false;
  }

  $: if (verificationNotice && verificationNotice.message) {
    const key = `${verificationNotice.variant ?? 'info'}::${verificationNotice.message}`;
    if (key !== lastNoticeKey) {
      openAlert(verificationNotice.message, verificationNotice.variant ?? 'info');
      lastNoticeKey = key;
      dispatch('notice-consumed');
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    resetFeedback();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      const msg = $t('login.form.errors.missing_email');
      feedback = msg;
      feedbackKind = 'error';
      openAlert(msg);
      return;
    }
    if (!emailPattern.test(trimmedEmail)) {
      const msg = $t('login.form.errors.invalid_email');
      feedback = msg;
      feedbackKind = 'error';
      openAlert(msg);
      return;
    }
    if (!password) {
      const msg = $t('login.form.errors.missing_password');
      feedback = msg;
      feedbackKind = 'error';
      openAlert(msg);
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
      } else if (code === 'auth/email-not-verified') {
        feedback = $t('login.form.errors.email_not_verified');
      } else if (code === 'auth/user-inactive') {
        feedback = $t('login.form.errors.account_inactive');
      } else if (code === 'auth/user-disabled') {
        feedback = $t('login.form.errors.account_disabled');
      } else if (code === 'auth/too-many-requests') {
        feedback = $t('login.form.errors.too_many_attempts');
      } else {
        feedback = $t('login.form.errors.generic');
      }
      openAlert(feedback, 'error');
    } finally {
      loginPending = false;
    }
  }

  async function onForgot(event) {
    event.preventDefault();
    resetFeedback();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      const msg = $t('login.form.errors.missing_email');
      feedback = msg;
      feedbackKind = 'error';
      openAlert(msg);
      return;
    }
    if (!emailPattern.test(trimmedEmail)) {
      const msg = $t('login.form.errors.invalid_email');
      feedback = msg;
      feedbackKind = 'error';
      openAlert(msg);
      return;
    }

    forgotPending = true;
    try {
      await sendPasswordResetIfExists(trimmedEmail);
      const successMsg = $t('login.form.success.reset_link_sent');
      feedback = successMsg;
      feedbackKind = 'info';
      openAlert(successMsg, 'info');
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
  <Topbar
    titleKey="login.title"
    showUserMenu={false}
    showSessionIndicator={showSessionIndicator}
    sessionIndicator={sessionIndicator}
  />

  <main class="auth-screen">
    <h1 class="sr-only">{$t('login.title')}</h1>

    <div class="auth-layout">
      <Card className="auth-card">
        <form class="auth-form" aria-label={formSectionLabel} on:submit|preventDefault={onSubmit} novalidate>
          <div class="form-header">
            <h2 class="panel-title">{$t('login.title')}</h2>
            <p class="panel-subtitle">{formSectionLabel}</p>
          </div>

          <InputField
            id="email"
            label={emailLabel}
            type="email"
            name="email"
            bind:value={email}
            placeholder={emailPlaceholder}
            required={true}
            aria-invalid={emailInvalid}
            autocomplete="email"
            inputmode="email"
            showRequiredIndicator={false}
          />

          <InputField
            id="password"
            label={passwordLabel}
            type="password"
            name="password"
            bind:value={password}
            placeholder={passwordPlaceholder}
            required={true}
            autocomplete="current-password"
            showRequiredIndicator={false}
          />

          {#if feedback}
            <p class="sr-only" role={messageRole} aria-live="polite">
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

          <div class="form-actions cluster">
            <Button variant="primary" type="submit" loading={loginPending} disabled={loginPending}>
              {submitDisplay}
            </Button>
            <Button
              variant="link"
              type="button"
              on:click={onForgot}
              disabled={forgotPending}
            >
              {forgotDisplay}
            </Button>
          </div>

          <p class="register-hint">
            {registerPrompt}
            <Button variant="link" type="button" on:click={goRegistration}>
              {registerLink}
            </Button>
          </p>
        </form>
      </Card>
    </div>
  </main>

  <Footbar />
</div>

<AlertPopup
  open={alertOpen}
  title={$t('login.title')}
  message={alertMessage}
  variant={alertVariant}
  on:close={closeAlert}
/>

<style>
  .page {
    position: relative;
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

  .register-hint {
    margin: 0.75rem 0 0;
    font-size: 0.95rem;
    color: #f0f3f7;
    text-align: center;
  }

  .register-hint :global(.btn--link) {
    margin-left: 0.4rem;
  }
</style>
