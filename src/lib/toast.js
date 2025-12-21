import { writable } from 'svelte/store';

export const toasts = writable([]);

let toastId = 0;

export function showToast({ message, variant = 'success', duration = 2600 } = {}) {
  if (!message) return null;
  const id = ++toastId;
  const entry = { id, message, variant };
  toasts.update((list) => [...list, entry]);

  if (duration && duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }

  return id;
}

export function dismissToast(id) {
  if (!id) return;
  toasts.update((list) => list.filter((toast) => toast.id !== id));
}
