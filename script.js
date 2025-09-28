/* Offline Clicker — script.js
   Features:
   - Persistent save to localStorage
   - Auto-save every 5s
   - Upgrades: Click Power, Multiplier, Autoclicker
   - Floating +1 animation
   - Install prompt for Android (beforeinstallprompt)
   - Basic sound feedback (using WebAudio)
*/

(() => {
  // ---- State & defaults ----
  const STORAGE_KEY = 'offline-clicker-v1';
  const AUTOSAVE_MS = 5000;

  const defaultState = {
    score: 0,
    clickPower: 1,
    multiplier: 1,
    perSecond: 0,
    upgrades: {
      clickPower: { level: 0, baseCost: 10 },
      multiplier: { level: 0, baseCost: 50 },
      autoclicker: { level: 0, baseCost: 100, interval: 1000 }
    },
    prestige: 0,
    settings: { sound: true }
  };

  let state = load() || defaultState;

  // ---- Elements ----
  const scoreEl = document.getElementById('score');
  const perSecEl = document.getElementById('perSec');
  const bigClick = document.getElementById('bigClick');
  const floatingLayer = document.getElementById('floatingLayer');
  const upgradesList = document.getElementById('upgradesList');
  const upgradeTpl = document.getElementById('upgradeTpl');
  const installBtn = document.getElementById('installBtn');
  const soundToggle = document.getElementById('soundToggle');
  const prestigeBtn = document.getElementById('prestigeBtn');
  const resetBtn = document.getElementById('resetBtn');

  // Install prompt handling
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'inline-block';
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) {
      // iOS: show a short help popup (can't trigger programmatically)
      alert('On iOS: tap the Share button in Safari, then "Add to Home Screen".');
      return;
    }
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.style.display = 'none';
  });

  // sound
  soundToggle.checked = state.settings.sound;
  soundToggle.addEventListener('change', () => {
    state.settings.sound = soundToggle.checked;
    save();
  });
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playClickSound() {
    if (!state.settings.sound) return;
    try {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = 520 + Math.random()*80;
      g.gain.value = 0.08;
      o.connect(g); g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + 0.06);
    } catch (e) { /* mobile autoplay restrictions may block until interaction */ }
  }

  // ---- UI helpers ----
  function updateUI() {
    scoreEl.textContent = Math.floor(state.score);
    const perSec = computePerSecond();
    state.perSecond = perSec;
    perSecEl.textContent = `${perSec.toFixed(1)} / sec`;
    renderUpgrades();
  }

  function showFloating(text, xPercent = 50) {
    const el = document.createElement('div');
    el.className = 'floater';
    el.style.left = xPercent + '%';
    el.textContent = text;
    floatingLayer.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  // ---- Game mechanics ----
  function computePerSecond() {
    const auto = state.upgrades.autoclicker.level;
    const rate = (auto * (1 + state.upgrades.multiplier.level * 0.2));
    return rate * state.clickPower * (1 + state.upgrades.multiplier.level * 0.1);
  }

  function clickAction(xPercent) {
    const gain = state.clickPower * (1 + state.upgrades.multiplier.level * 0.1);
    state.score += gain;
    playClickSound();
    showFloating('+' + Math.floor(gain), xPercent);
    updateUI();
  }

  bigClick.addEventListener('click', (ev) => {
    const rect = bigClick.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 100;
    clickAction(x);
  });

  // Autoclicker loop
  setInterval(() => {
    const auto = state.upgrades.autoclicker.level;
    if (auto <= 0) return;
    // apply auto clicks per second based on level
    const clicks = auto * 0.5; // scale
    const gain = clicks * state.clickPower * (1 + state.upgrades.multiplier.level * 0.1);
    state.score += gain;
    updateUI();
  }, 1000);

  // Offline accumulation per second when the tab is running is handled by per-second - above we approximate.

  // ---- Upgrades ----
  const upgradeDefs = [
    {
      key: 'clickPower',
      title: 'Click Power',
      desc: 'Increase how much each manual click gives.',
      cost: (lvl, base) => Math.round(base * Math.pow(1.6, lvl))
    },
    {
      key: 'multiplier',
      title: 'Multiplier',
      desc: 'Bonus multiplier to click value and autos.',
      cost: (lvl, base) => Math.round(base * Math.pow(2.0, lvl))
    },
    {
      key: 'autoclicker',
      title: 'Autoclicker',
      desc: 'Automatically gain clicks over time.',
      cost: (lvl, base) => Math.round(base * Math.pow(1.9, lvl))
    }
  ];

  function renderUpgrades() {
    upgradesList.innerHTML = '';
    upgradeDefs.forEach(def => {
      const inst = upgradeTpl.content.cloneNode(true);
      const dom = inst.querySelector('.upgrade');
      dom.querySelector('.u-title').textContent = def.title;
      dom.querySelector('.u-desc').textContent = def.desc;
      const level = state.upgrades[def.key].level;
      const base = state.upgrades[def.key].baseCost;
      const cost = def.cost(level, base);
      dom.querySelector('.u-cost').textContent = `${cost}`;
      const buyBtn = dom.querySelector('.u-buy');
      buyBtn.textContent = `Buy (${level})`;
      buyBtn.disabled = state.score < cost;
      buyBtn.addEventListener('click', () => {
        if (state.score >= cost) {
          state.score -= cost;
          state.upgrades[def.key].level++;
          // small effect
          if (def.key === 'clickPower') state.clickPower += 1;
          updateUI();
          save();
          playClickSound();
          showFloating('-' + cost, 76); // show cost spent
        } else {
          // not enough
          showFloating('Nope', 80);
        }
      });
      upgradesList.appendChild(dom);
    });
  }

  // Prestige: reset for prestige points (simple)
  prestigeBtn.addEventListener('click', () => {
    if (!confirm('Prestige will reset progress but grant a permanent +1 clickPower. Proceed?')) return;
    state.prestige++;
    state = JSON.parse(JSON.stringify(defaultState));
    state.clickPower += state.prestige;
    save();
    updateUI();
  });

  resetBtn.addEventListener('click', () => {
    if (!confirm('Completely reset everything?')) return;
    state = JSON.parse(JSON.stringify(defaultState));
    save();
    updateUI();
  });

  // ---- Save / Load ----
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Save failed', e);
    }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Load failed', e); return null;
    }
  }

  // Auto-save
  setInterval(save, AUTOSAVE_MS);
  window.addEventListener('beforeunload', save);

  // Init
  updateUI();
  renderUpgrades();

  // Try to register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(() => console.log('SW registered'))
      .catch(e => console.warn('SW failed', e));
  }

  // small UI nudge if installed
  window.addEventListener('appinstalled', () => {
    installBtn.style.display = 'none';
    alert('Thanks for installing Offline Clicker! 🎉');
  });

  // resume audio context on first user gesture (fix mobile autoplay)
  document.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }, { once: true });

})();
