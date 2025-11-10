<script>
  import { createEventDispatcher } from 'svelte';
  import QRCode from 'qrcode';
  import { t } from '../../lib/i18n.js';

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
</script>

{#if open}
  <div class="config-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="share-title">
    <div class="config-modal share">
      <header class="modal-header">
        <h3 id="share-title">{$t('configure.share_title')}</h3>
      </header>
      <div class="modal-body">
        <p class="hint">{$t('configure.share_hint')}</p>
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
      <footer class="modal-actions">
        <button class="btn secondary" type="button" on:click={cancelShare}>
          {$t('common.actions.cancel')}
        </button>
        <button class="btn primary" type="button" on:click={closeShare}>
          {$t('common.actions.close')}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .config-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    display: grid;
    place-items: center;
    z-index: 1300;
    padding: 1rem;
  }
  .config-modal.share {
    width: min(460px, 95vw);
    background: rgba(8, 14, 24, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    padding: 1.5rem;
    color: #f5f8fb;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .modal-body {
    display: grid;
    gap: 1rem;
    text-align: center;
  }
  .game-id {
    font-size: 2rem;
    letter-spacing: 0.2em;
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
    color: rgba(245, 245, 245, 0.7);
  }

  .qr-placeholder.loading {
    animation: pulse 1.4s ease-in-out infinite;
  }

  .qr-placeholder.error {
    color: #ffb0b0;
    border-color: rgba(255, 120, 120, 0.7);
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }
</style>
