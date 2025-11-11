<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../lib/i18n.js';
  import Modal from '../ui/Modal.svelte';

  export let open = false;

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('cancel');
  }

  function autoAssign() {
    dispatch('auto');
  }

  function confirm() {
    dispatch('save');
  }
  const hint = $t('configure.match_hint');
</script>

<Modal
  open={open}
  title={$t('configure.match_title')}
  description={hint}
  size="sm"
  on:close={close}
>
  <div class="match-body">
    <div class="match-actions">
      <button class="btn secondary" type="button" on:click={close}>{$t('common.actions.cancel')}</button>
      <button class="btn primary" type="button" on:click={confirm}>{$t('common.actions.save')}</button>
    </div>
  </div>
</Modal>

<style>
  .match-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .match-actions {
    display: flex;
    gap: 0.75rem;
  }
  .match-actions .btn {
    flex: 1;
    justify-content: center;
  }
  .btn {
    border: none;
    border-radius: 999px;
    padding: 0.55rem 1.2rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn.primary {
    background: #1f6b2b;
    color: #f6fff6;
  }
  .btn.secondary {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(248, 248, 250, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.18);
  }
</style>
