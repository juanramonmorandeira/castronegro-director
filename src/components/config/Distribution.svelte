<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../lib/i18n.js';

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
</script>

{#if open}
  <div class="config-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="distribution-title">
    <div class="config-modal full">
      <header class="modal-header">
        <div>
          <h3 id="distribution-title">{$t('configure.distribution_title')}</h3>
          <p class="modal-hint">{$t('configure.distribution_hint')}</p>
        </div>
      </header>
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
              on:pointerdown={(event) => handlePointerDown(token, event)}
            >
              <span class="token-role">{token.role}</span>
              <span class="token-category">{$t(`configure.balance_roles.${token.category}`)}</span>
            </button>
          {/each}
        {/if}
      </div>
      <footer class="modal-actions">
        <button class="btn secondary" type="button" on:click={close}>{$t('common.actions.cancel')}</button>
        <button class="btn primary" type="button" on:click={save}>{$t('common.actions.save')}</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .config-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(2, 6, 14, 0.8);
    display: grid;
    place-items: center;
    z-index: 1250;
    padding: 1rem;
  }
  .config-modal.full {
    width: min(1200px, 98vw);
    min-height: 70vh;
    background: #04070f;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 32px;
    padding: 2rem;
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
  .modal-hint {
    margin: 0.35rem 0 0;
    font-size: 0.9rem;
    color: rgba(245, 245, 245, 0.65);
  }
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
    color: rgba(245, 245, 245, 0.65);
    text-align: center;
  }
  .role-token {
    position: absolute;
    left: var(--x);
    top: var(--y);
    transform: translate(-50%, -50%);
    width: 92px;
    height: 92px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.25);
    background: rgba(8, 14, 22, 0.9);
    color: #f5f8fb;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    font-weight: 600;
    cursor: grab;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    border-width: 2px;
  }
  .role-token:active {
    cursor: grabbing;
  }
  .token-role {
    font-size: 0.9rem;
  }
  .token-category {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(245, 245, 245, 0.75);
  }
  .role-token.category-villagers {
    border-color: rgba(255, 221, 150, 0.8);
  }
  .role-token.category-ambiguous {
    border-color: rgba(195, 188, 255, 0.8);
  }
  .role-token.category-outsiders {
    border-color: rgba(255, 180, 135, 0.8);
  }
  .role-token.category-werewolves {
    border-color: rgba(255, 120, 120, 0.85);
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }
  .btn.primary {
    background: #1f6b2b;
    color: #f6fff6;
    border-radius: 999px;
    padding: 0.6rem 1.4rem;
    border: none;
  }
  .btn.secondary {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(248, 248, 250, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 999px;
    padding: 0.6rem 1.4rem;
  }
</style>
