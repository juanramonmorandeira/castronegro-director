<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../lib/i18n.js';
  import Modal from '../ui/Modal.svelte';
  import Button from '../ui/Button.svelte';

  export let open = false;
  export let tokens = [];

  const dispatch = createEventDispatcher();
  let boardElement;
  let positions = {};
  let activeId = null;
  let activePointerId = null;
  let boardRect = null;
  let pointerOffset = { x: 0, y: 0 };

  $: syncPositions();

  function syncPositions() {
    if (!tokens) return;
    const columns = Math.max(1, Math.ceil(Math.sqrt(tokens.length || 1)));
    const rows = Math.max(1, Math.ceil((tokens.length || 1) / columns));
    const next = {};
    tokens.forEach((token, index) => {
      if (positions[token.id]) {
        next[token.id] = positions[token.id];
      } else {
        const col = index % columns;
        const row = Math.floor(index / columns);
        next[token.id] = {
          x: ((col + 1) / (columns + 1)) * 100,
          y: ((row + 1) / (rows + 1)) * 100
        };
      }
    });
    positions = next;
  }

  function arcId(token) {
    if (!token?.id) return '';
    return `arc-${token.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  function close() {
    dispatch('cancel');
  }

  function save() {
    dispatch('save');
  }

  function handlePointerDown(token, event) {
    if (!boardElement) return;
    boardRect = boardElement.getBoundingClientRect();
    const pos = positions[token.id] ?? { x: 50, y: 50 };
    pointerOffset = {
      x: ((event.clientX - boardRect.left) / boardRect.width) * 100 - pos.x,
      y: ((event.clientY - boardRect.top) / boardRect.height) * 100 - pos.y
    };
    activeId = token.id;
    activePointerId = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updatePosition(clientX, clientY) {
    if (!boardRect || !activeId) return;
    const relativeX = ((clientX - boardRect.left) / boardRect.width) * 100 - pointerOffset.x;
    const relativeY = ((clientY - boardRect.top) / boardRect.height) * 100 - pointerOffset.y;
    const x = Math.min(95, Math.max(5, relativeX));
    const y = Math.min(95, Math.max(5, relativeY));
    positions = { ...positions, [activeId]: { x, y } };
  }

  function handlePointerMove(event) {
    if (!activeId) return;
    updatePosition(event.clientX, event.clientY);
  }

  function handlePointerUp() {
    if (activePointerId != null) {
      boardElement?.releasePointerCapture?.(activePointerId);
    }
    activeId = null;
    activePointerId = null;
  }

  function handlePointerLeave() {
    handlePointerUp();
  }
  const distributionHint = $t('configure.distribution_hint');
</script>

<Modal
  open={open}
  title={$t('configure.distribution_title')}
  description={distributionHint}
  size="xl"
  closeOnBackdrop={false}
  on:close={close}
>
  <div
    class="distribution-board"
    bind:this={boardElement}
    on:pointermove={handlePointerMove}
    on:pointerup={handlePointerUp}
    on:pointerleave={handlePointerLeave}
  >
    {#if tokens.length === 0}
      <p class="board-empty">{$t('configure.role_preview_empty')}</p>
    {:else}
      {#each tokens as token}
        <button
          type="button"
          class={`role-token category-${token.category}`}
          style={`--x:${positions[token.id]?.x ?? 50}%; --y:${positions[token.id]?.y ?? 50}%;`}
          title={token.role}
          on:pointerdown={(event) => handlePointerDown(token, event)}
        >
          {#if token.player}
            <span class="token-player">{token.player}</span>
          {:else}
            <span class="token-player token-player--placeholder"></span>
          {/if}
          <span class="token-circle">
            {#if token.image}
              <img src={token.image} alt={token.role} draggable="false" />
            {:else}
              <span class="token-initials">{token.role?.[0] ?? '?'}</span>
            {/if}
          </span>
          <span class="token-role" aria-hidden="true">{token.role}</span>
          <span class="sr-only">{token.role}</span>
        </button>
      {/each}
    {/if}
  </div>

  <svelte:fragment slot="footer">
    <Button variant="ghost" type="button" on:click={close}>{$t('common.actions.cancel')}</Button>
    <Button variant="primary" type="button" on:click={save}>{$t('common.actions.save')}</Button>
  </svelte:fragment>
</Modal>

<style>
  .distribution-board {
    flex: 1;
    border: 1px dashed rgba(255, 255, 255, 0.2);
    border-radius: 24px;
    position: relative;
    overflow: hidden;
    min-height: 420px;
    margin-top: 0.5rem;
    background: radial-gradient(circle at center, rgba(255, 255, 255, 0.04), transparent 60%);
    touch-action: none;
  }
  .board-empty {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    margin: 0;
    color: var(--color-white-muted);
    text-align: center;
  }
.role-token {
  position: absolute;
  left: var(--x);
  top: var(--y);
  transform: translate(-50%, -50%);
  width: 110px;
  color: var(--color-white-contrast);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.05rem;
  padding: 0.1rem 0.1rem 0.2rem;
  font-weight: 600;
  cursor: grab;
  background: transparent;
  border: none;
}
.role-token:active {
  cursor: grabbing;
}
.token-player {
  font-size: 0.75rem;
  color: var(--color-white-muted);
  min-height: 1em;
  max-width: 100%;
  text-align: center;
}
.token-player--placeholder {
  visibility: hidden;
}
.token-circle {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.35);
  background: rgba(3, 6, 14, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
.token-circle img {
  width: 72px;
  height: 72px;
  object-fit: contain;
  border-radius: 50%;
  pointer-events: none;
  user-select: none;
}
.token-initials {
  font-size: 1.2rem;
  letter-spacing: 0.08em;
}
.token-role {
  width: 110px;
  text-align: center;
  font-family: var(--font-body);
  font-size: 0.98rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--color-white-muted);
  margin-top: 8px;
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
.role-token.category-villagers .token-circle {
  border-color: var(--color-green-cta--primary);
}
.role-token.category-ambiguous .token-circle {
  border-color: var(--color-gold-info);
}
.role-token.category-loners .token-circle {
  border-color: var(--color-white-contrast);
}
.role-token.category-werewolves .token-circle {
  border-color: var(--color-error-strong);
}
</style>
