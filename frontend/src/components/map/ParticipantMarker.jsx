// Vanilla DOM helper, NOT a React component. Returns an element to attach to a
// Mapbox marker plus an `update` fn that mutates inner pieces in place. Lives
// outside React's render cycle so position/heading changes don't trigger
// reconciliation — the map handles its own animation.

function arrowSvg(color) {
  return `
    <svg viewBox="0 0 32 32" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 3 L27 27 L16 22 L5 27 Z"
        fill="${color}"
        stroke="white"
        stroke-width="2.5"
        stroke-linejoin="round"
      />
    </svg>
  `;
}

export function createParticipantMarker({ color, displayName, isMe, isGhost, finished }) {
  const root = document.createElement('div');
  root.style.cssText = `
    position: relative;
    width: 32px;
    height: 32px;
    pointer-events: none;
  `;
  if (isGhost) root.style.opacity = '0.4';

  const arrow = document.createElement('div');
  arrow.style.cssText = `
    width: 32px;
    height: 32px;
    transition: transform 0.4s linear;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
  `;
  arrow.innerHTML = arrowSvg(color);

  const label = document.createElement('div');
  label.style.cssText = `
    position: absolute;
    top: 34px;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #1f2937;
    white-space: nowrap;
    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  `;
  label.textContent = displayName + (isMe ? ' (you)' : '');
  if (finished) label.textContent += ' ✓';

  root.appendChild(arrow);
  root.appendChild(label);

  function update(state) {
    // `rotation` is the arrow's screen-coordinate rotation, already adjusted
    // for current map bearing by the caller (so the arrow points in the
    // participant's true heading regardless of how the map is rotated).
    if (state.rotation != null) {
      arrow.style.transform = `rotate(${state.rotation}deg)`;
    }
    if (state.isGhost !== undefined) {
      root.style.opacity = state.isGhost ? '0.4' : '1';
    }
    if (state.finished !== undefined) {
      const base = displayName + (isMe ? ' (you)' : '');
      label.textContent = state.finished ? `${base} ✓` : base;
    }
  }

  return { element: root, update };
}
