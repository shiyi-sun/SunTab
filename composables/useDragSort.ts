import { onBeforeUnmount, onMounted, reactive, ref, type Ref } from 'vue';

export interface DragSortOptions {
  container: Ref<HTMLElement | null>;
  itemSelector?: string;
  onReorder: (from: number, insertAt: number) => void;
}

interface PendingDrag {
  element: HTMLElement;
  id: string;
  from: number;
  startX: number;
  startY: number;
  pointerId: number;
}

export function useDragSort(options: DragSortOptions) {
  const selector = options.itemSelector ?? '[data-nav-id]';
  const dragging = ref(false);
  const draggingId = ref('');
  const indicator = reactive({ visible: false, left: 0, top: 0, height: 0 });

  let pending: PendingDrag | null = null;
  let source: HTMLElement | null = null;
  let ghost: HTMLElement | null = null;
  let sourceOpacity = '';
  let grabOffsetX = 0;
  let grabOffsetY = 0;
  let insertAt = -1;
  let active = false;
  let lastX = 0;
  let lastY = 0;
  let scrollFrame = 0;
  let clickTimer: number | undefined;

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(selector);
    if (!target || !options.container.value?.contains(target)) return;
    if (target.dataset.dragDisabled === 'true') return;
    const index = Number(target.dataset.index ?? '');
    const id = target.dataset.navId ?? '';
    if (!Number.isInteger(index) || index < 0 || !id) return;

    pending = {
      element: target,
      id,
      from: index,
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
    };
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  }

  function onPointerMove(event: PointerEvent) {
    if (!pending) return;
    if (event.pointerId !== pending.pointerId) return;
    // Ignore uncorrelated mouse hover events while a drag is active.
    if (event.pointerType === 'mouse' && event.buttons === 0) return;
    if (!active) {
      const distance = Math.hypot(
        event.clientX - pending.startX,
        event.clientY - pending.startY,
      );
      if (distance < 6) return;
      startDrag();
    }
    event.preventDefault();
    lastX = event.clientX;
    lastY = event.clientY;
    moveGhost(lastX, lastY);
    updateIndicator(lastX, lastY);
    scheduleAutoScroll();
  }

  function startDrag() {
    if (!pending || !sourceIsValid()) return;
    active = true;
    source = pending.element;
    sourceOpacity = source.style.opacity;
    source.style.opacity = '0.26';
    dragging.value = true;
    draggingId.value = pending.id;
    document.body.classList.add('is-dragging-item');

    const rect = source.getBoundingClientRect();
    grabOffsetX = pending.startX - rect.left;
    grabOffsetY = pending.startY - rect.top;

    ghost = source.cloneNode(true) as HTMLElement;
    ghost.classList.add('nav-drag-ghost');
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.opacity = '';
    const computed = getComputedStyle(source);
    for (const token of [
      '--icon-size',
      '--icon-gap',
      '--icon-radius',
      '--icon-label-size',
      '--icon-label-color',
      '--icon-label-display',
      '--accent',
    ]) {
      ghost.style.setProperty(token, computed.getPropertyValue(token));
    }
    document.body.appendChild(ghost);

    window.addEventListener('click', blockClick, true);
    window.addEventListener('keydown', onKeydown, true);
    updateIndicator(pending.startX, pending.startY);
  }

  function sourceIsValid() {
    return Boolean(pending && options.container.value?.contains(pending.element));
  }

  function moveGhost(x: number, y: number) {
    if (!ghost) return;
    ghost.style.left = `${x - grabOffsetX}px`;
    ghost.style.top = `${y - grabOffsetY}px`;
  }

  function showIndicatorAt(item: HTMLElement, x: number, gap: number) {
    const index = Number(item.dataset.index ?? '');
    if (!Number.isInteger(index)) return;
    const rect = item.getBoundingClientRect();
    const before = x < rect.left + rect.width / 2;
    insertAt = index + (before ? 0 : 1);
    indicator.visible = true;
    indicator.left = before ? rect.left - gap / 2 - 1.5 : rect.right + gap / 2 - 1.5;
    indicator.top = rect.top;
    indicator.height = rect.height;
  }

  function updateIndicator(x: number, y: number) {
    const container = options.container.value;
    if (!container || !active) return;
    const items = Array.from(container.querySelectorAll<HTMLElement>(selector));
    if (!items.length) {
      indicator.visible = false;
      insertAt = -1;
      return;
    }

    const hit = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>(
      selector,
    );
    const target = hit && container.contains(hit) ? hit : null;
    const grid = container.querySelector<HTMLElement>('.grid') ?? container;
    const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;

    if (target) {
      showIndicatorAt(target, x, gap);
      return;
    }

    const gridRect = grid.getBoundingClientRect();
    const inside =
      x >= gridRect.left - 24 &&
      x <= gridRect.right + 24 &&
      y >= gridRect.top - 24 &&
      y <= gridRect.bottom + 56;
    if (!inside) {
      indicator.visible = false;
      insertAt = -1;
      return;
    }

    let nearest = items[0]!;
    let nearestDistance = Infinity;
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
      const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = item;
      }
    }
    showIndicatorAt(nearest, x, gap);
  }

  function scheduleAutoScroll() {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      if (!active) return;
      const edge = 72;
      const speed = 16;
      if (lastY < edge) {
        window.scrollBy(0, -speed);
      } else if (lastY > window.innerHeight - edge) {
        window.scrollBy(0, speed);
      } else {
        return;
      }
      moveGhost(lastX, lastY);
      updateIndicator(lastX, lastY);
      scheduleAutoScroll();
    });
  }

  function onPointerUp(event: PointerEvent) {
    if (pending && event.pointerId === pending.pointerId) finish(true);
  }

  function onPointerCancel(event: PointerEvent) {
    if (pending && event.pointerId === pending.pointerId) finish(false);
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !active) return;
    event.preventDefault();
    finish(false);
  }

  function blockClick(event: MouseEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.removeEventListener('click', blockClick, true);
  }

  function finish(commit: boolean) {
    const wasActive = active;
    const from = pending?.from ?? -1;
    const targetIndex = insertAt;
    cleanup();
    if (!commit || !wasActive) return;
    if (targetIndex < 0 || targetIndex === from || targetIndex === from + 1) return;
    options.onReorder(from, targetIndex);
  }

  function cleanup() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('keydown', onKeydown, true);
    if (scrollFrame) {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = 0;
    }
    if (ghost) {
      ghost.remove();
      ghost = null;
    }
    if (source) {
      source.style.opacity = sourceOpacity;
      source = null;
    }
    document.body.classList.remove('is-dragging-item');
    indicator.visible = false;
    insertAt = -1;
    dragging.value = false;
    draggingId.value = '';
    pending = null;
    active = false;

    if (clickTimer) window.clearTimeout(clickTimer);
    clickTimer = window.setTimeout(() => {
      window.removeEventListener('click', blockClick, true);
    }, 320);
  }

  onMounted(() => {
    options.container.value?.addEventListener('pointerdown', onPointerDown);
  });

  onBeforeUnmount(() => {
    options.container.value?.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('click', blockClick, true);
    if (clickTimer) window.clearTimeout(clickTimer);
    cleanup();
  });

  return {
    dragging,
    draggingId,
    indicator,
  };
}
