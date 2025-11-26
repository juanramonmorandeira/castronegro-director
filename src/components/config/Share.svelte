<script>
  import { createEventDispatcher } from 'svelte';
  import QRCode from 'qrcode';
  import { t } from '../../lib/i18n.js';
  import Modal from '../ui/Modal.svelte';
  import Button from '../ui/Button.svelte';

  export let open = false;
  export let gameId = '';

  const dispatch = createEventDispatcher();

  let qrDataUrl = '';
  let qrError = '';
  let qrLoading = false;
  let qrTaskId = 0;

  $: formatted = (gameId || '—').replace(/\s+/g, ' ').trim();

  $: if (open) {
    generateQr(formatted);
  } else {
    resetQr();
  }

  function cancelShare() {
    dispatch('cancel');
  }

  function closeShare() {
    dispatch('close');
  }

  function resetQr() {
    qrDataUrl = '';
    qrError = '';
    qrLoading = false;
  }

  async function generateQr(value) {
    const cleanValue = value && value !== '—' ? value : (gameId || '').trim();
    if (!cleanValue) {
      resetQr();
      return;
    }
    const task = ++qrTaskId;
    qrLoading = true;
    qrError = '';
    qrDataUrl = '';
    try {
      const url = await QRCode.toDataURL(cleanValue, {
        margin: 1,
        width: 220,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000ff',
          light: '#ffffffff'
        }
      });
      if (task === qrTaskId) {
        qrDataUrl = url;
      }
    } catch (error) {
      if (task === qrTaskId) {
        console.error('[share] QR generation failed', error);
        qrError = error?.message ?? 'QR generation failed';
      }
    } finally {
      if (task === qrTaskId) {
        qrLoading = false;
      }
    }
  }
  const shareHint = $t('configure.share_hint');
</script>

<Modal
  open={open}
  title={$t('configure.share_title')}
  description={shareHint}
  size="sm"
  on:close={cancelShare}
>
  <div class="modal-body">
    <div class="game-id">{formatted || '—'}</div>
    <div class="qr-panel">
      {#if qrLoading}
        <div class="qr-placeholder loading">{$t('configure.share_qr_generating')}</div>
      {:else if qrError}
        <div class="qr-placeholder error">{qrError}</div>
      {:else if qrDataUrl}
        <img src={qrDataUrl} alt={$t('configure.share_qr_alt')} />
      {:else}
        <div class="qr-placeholder">{$t('configure.share_qr_placeholder')}</div>
      {/if}
    </div>
  </div>

  <svelte:fragment slot="footer">
    <Button variant="ghost" type="button" on:click={cancelShare}>
      {$t('common.actions.cancel')}
    </Button>
    <Button variant="primary" type="button" on:click={closeShare}>
      {$t('common.actions.save')}
    </Button>
  </svelte:fragment>
</Modal>

<style>
  .modal-body {
    display: grid;
    gap: 1rem;
    text-align: center;
  }
  .game-id {
    font-size: 2.1rem;
    letter-spacing: 0.22em;
    font-weight: 600;
  }
  .qr-panel {
    display: grid;
    place-items: center;
  }

  .qr-panel img {
    width: 220px;
    height: 220px;
    border-radius: 16px;
    background: #fff;
    padding: 0.75rem;
  }

  .qr-placeholder {
    border: 1px dashed rgba(255, 255, 255, 0.3);
    border-radius: 16px;
    padding: 2rem;
    color: var(--color-white-muted);
  }

  .qr-placeholder.loading {
    animation: pulse 1.4s ease-in-out infinite;
  }

  .qr-placeholder.error {
    color: var(--color-error-soft);
    border-color: var(--color-error-soft);
  }

  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }
</style>
