(function () {
  var DEFAULT_BG =
    'radial-gradient(120% 110% at 76% -10%, rgba(58, 160, 184, 0.3), transparent 60%), radial-gradient(90% 90% at 8% 108%, rgba(214, 120, 72, 0.16), transparent 62%), radial-gradient(140% 130% at 50% 42%, #111d30 0%, #0a1321 52%, #05080f 100%)';
  var PAPER_BG =
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.12'/%3E%3C/svg%3E") center / 140px 140px repeat, radial-gradient(80% 60% at 50% 18%, rgba(242, 238, 230, 0.15), transparent 65%), radial-gradient(120% 100% at 50% 120%, rgba(140, 108, 80, 0.14), transparent 60%), radial-gradient(120% 120% at 50% 50%, #181715 0%, #111110 55%, #070706 100%)`;
  var LEGACY_BG =
    'linear-gradient(135deg, #0b1026 0%, #1b2a6b 35%, #6d3b8f 68%, #e07a5f 100%)';
  var NIGHT_MIGRATED_KEY = 'suntab:migrated-default-night';
  var KEY = 'suntab:bootstrap';

  var snapshot = null;
  try {
    snapshot = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch (error) {
    snapshot = null;
  }

  var wallpaper =
    snapshot && snapshot.wallpaper
      ? snapshot.wallpaper
      : { kind: 'gradient', value: DEFAULT_BG, blur: 0, dim: 10 };

  if (wallpaper.kind === 'gradient') {
    var oldDefault = false;
    try {
      oldDefault =
        wallpaper.value === PAPER_BG &&
        localStorage.getItem(NIGHT_MIGRATED_KEY) !== '1';
    } catch (error) {
      oldDefault = false;
    }
    if (wallpaper.value === LEGACY_BG || oldDefault) {
      wallpaper.value = DEFAULT_BG;
    }
  }

  var root = document.createElement('div');
  root.id = 'suntab-early-bg';
  root.style.cssText =
    'position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;';

  var background = document.createElement('div');
  background.style.cssText =
    'position:absolute;inset:-30px;background-size:cover;background-position:center;' +
    'transform:scale(1.04);filter:blur(' +
    (Math.max(0, Math.min(20, Number(wallpaper.blur) || 0))) +
    'px);';

  if (wallpaper.kind === 'gradient' || wallpaper.kind === 'color') {
    background.style.background = wallpaper.value || DEFAULT_BG;
  } else if (wallpaper.thumb) {
    background.style.backgroundImage = 'url("' + wallpaper.thumb + '")';
  } else {
    background.style.background = DEFAULT_BG;
  }

  var scrim = document.createElement('div');
  scrim.style.cssText =
    'position:absolute;inset:0;background:rgba(0,0,0,' +
    Math.max(0, Math.min(80, Number(wallpaper.dim) || 0)) / 100 +
    ');';

  root.appendChild(background);
  root.appendChild(scrim);

  function mount() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', mount, { once: true });
      return;
    }
    document.body.appendChild(root);
  }

  function remove() {
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  mount();
  window.addEventListener('suntab-wallpaper-ready', remove, { once: true });
  window.setTimeout(remove, 2500);
})();
