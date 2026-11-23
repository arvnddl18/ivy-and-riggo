/**
 * Riggo & Ivy — Save Our Date Interactive Controller
 * 1. Gentle low-to-mid background music fade-in (0.00 -> 0.32 over 4.2s) with cubic ease-in.
 * 2. Full user audio control: Play/Pause toggle, Mute button, and smooth Volume Slider.
 * 3. 3D wax-sealed linen envelope opening -> Save Our Date card -> Kind Note warning modal.
 */

document.addEventListener('DOMContentLoaded', () => {
  const bgMusic = document.getElementById('bgMusic');
  const musicToggle = document.getElementById('musicToggle');
  const musicLabel = document.getElementById('musicLabel');
  const musicMuteBtn = document.getElementById('musicMuteBtn');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumePct = document.getElementById('volumePct');

  const unifiedStage = document.getElementById('unifiedStage');
  const luxuryEnvelope = document.getElementById('luxuryEnvelope');
  const letterPocketClip = document.getElementById('letterPocketClip');
  const openCardBtn = document.getElementById('openCardBtn');
  const stdCardFrame = document.getElementById('stdCardFrame');
  const panelTop = stdCardFrame ? stdCardFrame.querySelector('.trifold-panel--top') : null;
  const closeCardBtn = document.getElementById('closeCardBtn');
  const doneViewingBtn = document.getElementById('doneViewingBtn');

  const warningModal = document.getElementById('warningModal');
  const acknowledgeBtn = document.getElementById('acknowledgeBtn');
  const acknowledgedNote = document.getElementById('acknowledgedNote');
  const backToCardBtn = document.getElementById('backToCardBtn');

  let fadeRafId = null;
  let isFadingIn = false;
  let gestureFallbackArmed = false;
  let autoOpenTimerId = null;

  // Gentle mid-low target volume (32%) so music is warm and clearly hearable when the letter opens
  let userVolume = 0.32;
  let lastNonZeroVolume = 0.32;
  const AUTO_OPEN_DELAY_MS = 2000;
  const UNFOLD_SETTLE_MS = 2750;
  // Total fade-in from full page load (0ms) to letter completely opened (2000ms delay + 2750ms unfold = 4750ms)
  const FADE_IN_DURATION_MS = AUTO_OPEN_DELAY_MS + UNFOLD_SETTLE_MS;
  const FADE_OUT_DURATION_MS = 800;

  // Ensure initial audio element volume is strictly 0 before playback starts
  if (bgMusic) {
    bgMusic.volume = 0;
  }

  function syncSliderUI(vol01) {
    const pct = Math.round(Math.max(0, Math.min(1, vol01)) * 100);
    if (volumeSlider) {
      volumeSlider.value = String(pct);
      volumeSlider.style.setProperty('--vol-fill', `${pct}%`);
    }
    if (volumePct) {
      volumePct.textContent = `${pct}%`;
    }
    if (musicMuteBtn) {
      musicMuteBtn.classList.toggle('is-muted', pct === 0);
    }
  }

  syncSliderUI(userVolume);

  function cancelFade() {
    if (fadeRafId !== null) {
      cancelAnimationFrame(fadeRafId);
      fadeRafId = null;
    }
    isFadingIn = false;
  }

  function fadeVolume(fromVol, toVol, durationMs, onComplete) {
    if (!bgMusic) return;
    cancelFade();
    const startTime = performance.now();
    const rising = toVol > fromVol;
    isFadingIn = rising;
    bgMusic.volume = Math.max(0, Math.min(1, fromVol));

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Smooth perceptual curve: starts soft on load, swells through the 2s seal delay, and reaches full hearable volume as the letter unfolds
      const eased = rising
        ? Math.pow(progress, 1.65)
        : 1 - Math.pow(1 - progress, 2);

      const currentVol = Math.max(0, Math.min(1, fromVol + (toVol - fromVol) * eased));
      bgMusic.volume = currentVol;
      syncSliderUI(currentVol);

      if (progress < 1) {
        fadeRafId = requestAnimationFrame(step);
      } else {
        fadeRafId = null;
        isFadingIn = false;
        if (typeof onComplete === 'function') onComplete();
      }
    }

    fadeRafId = requestAnimationFrame(step);
  }

  function updateMusicUI(playing) {
    if (!musicToggle || !musicLabel) return;
    musicToggle.classList.toggle('is-playing', playing);
    musicToggle.setAttribute('aria-pressed', String(playing));
    musicLabel.textContent = playing ? 'Music On' : 'Music Off';
  }

  function armAutoplayGestureFallback() {
    if (gestureFallbackArmed) return;
    gestureFallbackArmed = true;

    const events = ['pointerdown', 'touchstart', 'click', 'keydown', 'wheel'];
    function onFirstGesture(e) {
      // Ignore clicks on the music toggle/mute/slider itself so we don't conflict with direct controls
      if (e && e.target && e.target.closest && e.target.closest('#musicDock')) {
        cleanup();
        return;
      }
      cleanup();
      if (bgMusic && bgMusic.paused) {
        startMusicWithGentleFadeIn(UNFOLD_SETTLE_MS);
      }
    }
    function cleanup() {
      gestureFallbackArmed = false;
      events.forEach((evt) => window.removeEventListener(evt, onFirstGesture, true));
    }
    events.forEach((evt) => window.addEventListener(evt, onFirstGesture, { capture: true, passive: true }));
  }

  function startMusicWithGentleFadeIn(customDurationMs) {
    if (!bgMusic) return;
    // If already playing and fading in from page load, let the continuous fade-in finish uninterrupted
    if (!bgMusic.paused && (isFadingIn || bgMusic.volume > 0.01)) {
      updateMusicUI(true);
      return;
    }

    cancelFade();
    const duration = typeof customDurationMs === 'number' ? customDurationMs : FADE_IN_DURATION_MS;
    bgMusic.volume = 0;
    syncSliderUI(0);

    const target = userVolume > 0 ? userVolume : lastNonZeroVolume;
    const playPromise = bgMusic.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          updateMusicUI(true);
          fadeVolume(0, target, duration);
        })
        .catch(() => {
          updateMusicUI(false);
          syncSliderUI(userVolume);
          armAutoplayGestureFallback();
        });
    }
  }

  function toggleMusic() {
    if (!bgMusic) return;
    if (bgMusic.paused) {
      startMusicWithGentleFadeIn();
    } else {
      fadeVolume(bgMusic.volume, 0, FADE_OUT_DURATION_MS, () => {
        bgMusic.pause();
        updateMusicUI(false);
        syncSliderUI(userVolume);
      });
    }
  }

  // Real-time volume slider control
  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      cancelFade();
      const val = Number(e.target.value) / 100;
      userVolume = Math.max(0, Math.min(1, val));
      if (userVolume > 0.02) {
        lastNonZeroVolume = userVolume;
      }
      if (bgMusic) {
        bgMusic.volume = userVolume;
        if (bgMusic.paused && userVolume > 0) {
          bgMusic.play().then(() => updateMusicUI(true)).catch(() => {});
        }
      }
      syncSliderUI(userVolume);
    });
  }

  // Quick Mute / Unmute toggle
  if (musicMuteBtn) {
    musicMuteBtn.addEventListener('click', () => {
      cancelFade();
      if (!bgMusic) return;
      if (bgMusic.volume > 0.01 && userVolume > 0.01) {
        lastNonZeroVolume = userVolume;
        userVolume = 0;
        fadeVolume(bgMusic.volume, 0, 280);
      } else {
        userVolume = lastNonZeroVolume || 0.32;
        if (bgMusic.paused) {
          startMusicWithGentleFadeIn();
        } else {
          fadeVolume(bgMusic.volume, userVolume, 400);
        }
      }
    });
  }

  let isOpened = false;

  /**
   * Computes exact pixel translateY & scale values so the folded 3-panel letter:
   * 1. Starts tucked strictly inside the envelope pocket (width = 86% of envelope, top edge inside the pocket).
   * 2. Rises cleanly out of the V-notch during phase-pull (showing ~46% of envelope height above the top edge).
   * 3. Glides continuously to translateY(0) scale(1) as it unfolds in phase-unfold with zero layout jump.
   */
  function syncLetterGeometry() {
    if (!stdCardFrame || !luxuryEnvelope || !panelTop || !letterPocketClip) return;

    const vh = window.innerHeight;
    const envH = luxuryEnvelope.offsetHeight || 295;
    const envW = luxuryEnvelope.offsetWidth || 440;
    const cardW = stdCardFrame.offsetWidth || 470;
    const h1 = panelTop.offsetHeight || 380;
    const clipStyle = window.getComputedStyle(letterPocketClip);
    const padTop = parseFloat(clipStyle.paddingTop) || 72;
    const rootStyle = window.getComputedStyle(document.documentElement);
    const envPullY = parseFloat(rootStyle.getPropertyValue('--env-pull-y')) || 90;

    // Fit folded letter width cleanly inside the envelope with ~7% breathing room on each side
    const tuckScale = Math.min(0.88, (envW * 0.86) / cardW);
    const pullScale = Math.min(0.90, (envW * 0.88) / cardW);

    // Envelope top edge is mathematically centered at exact 50vh
    const envTop = (vh - envH) / 2;

    // 1. Tucked inside envelope: top crease of folded packet sits 18% below envelope top (strictly hidden inside)
    const desiredTuckTop = envTop + envH * 0.18;
    const tuckY = desiredTuckTop - padTop - h1 * tuckScale;

    // 2. Pulled out of envelope: top crease rises 46% of envelope height ABOVE the pulled-down envelope top
    const pulledEnvTop = envTop + envPullY;
    const desiredPullTop = Math.max(24, pulledEnvTop - envH * 0.46);
    const pullY = desiredPullTop - padTop - h1 * pullScale;

    stdCardFrame.style.setProperty('--letter-tuck-scale', tuckScale.toFixed(4));
    stdCardFrame.style.setProperty('--letter-pull-scale', pullScale.toFixed(4));
    stdCardFrame.style.setProperty('--letter-tuck-y', `${tuckY.toFixed(1)}px`);
    stdCardFrame.style.setProperty('--letter-pull-y', `${pullY.toFixed(1)}px`);
  }

  syncLetterGeometry();
  window.addEventListener('resize', () => {
    if (!isOpened) syncLetterGeometry();
  });

  function openSaveTheDate() {
    if (isOpened) return;
    if (autoOpenTimerId !== null) {
      clearTimeout(autoOpenTimerId);
      autoOpenTimerId = null;
    }
    syncLetterGeometry();
    isOpened = true;

    // 1. Ensure background music fade-in is running (if already fading in from page load, continues seamlessly)
    startMusicWithGentleFadeIn(UNFOLD_SETTLE_MS);

    // 2. Phase 1 (0ms): Dissolve wax seal & flip 3D envelope flap open
    if (unifiedStage) {
      unifiedStage.classList.add('phase-flap');
    }

    // 3. Phase 2 (480ms): The real folded 3-panel letter rises smoothly out of the envelope as the envelope glides down
    setTimeout(() => {
      if (unifiedStage) {
        unifiedStage.classList.add('phase-pull');
      }
    }, 480);

    // 4. Phase 3 (1350ms): Continuous unfold — envelope finishes gliding away while the top & bottom letter panels unfold in 3D
    setTimeout(() => {
      if (unifiedStage) {
        unifiedStage.classList.add('phase-unfold');
      }
      if (stdCardFrame) {
        stdCardFrame.setAttribute('aria-hidden', 'false');
      }
    }, 1350);

    // 5. Phase 4 (2750ms): Unified flat letter settles with soft paper shadow as music reaches full target volume
    setTimeout(() => {
      if (unifiedStage) {
        unifiedStage.classList.add('phase-settled');
      }
    }, UNFOLD_SETTLE_MS);
  }

  // Wait until the page (and web fonts) are fully loaded, then:
  // - Immediately start the music fade-in (0% -> 32% over 4.75s)
  // - After a 2-second delay ("Opening the seal"), automatically trigger openSaveTheDate()
  let autoSequenceStarted = false;
  function startAutoOpenSequenceOnFullLoad() {
    if (autoSequenceStarted) return;
    autoSequenceStarted = true;

    const fontsReady = (document.fonts && document.fonts.ready)
      ? document.fonts.ready.catch(() => {})
      : Promise.resolve();

    fontsReady.then(() => {
      syncLetterGeometry();
      startMusicWithGentleFadeIn(FADE_IN_DURATION_MS);
      autoOpenTimerId = setTimeout(() => {
        autoOpenTimerId = null;
        openSaveTheDate();
      }, AUTO_OPEN_DELAY_MS);
    });
  }

  if (document.readyState === 'complete') {
    startAutoOpenSequenceOnFullLoad();
  } else {
    window.addEventListener('load', startAutoOpenSequenceOnFullLoad, { once: true });
  }

  function openWarningModal() {
    if (!warningModal) return;
    // Reset button & confirmation state cleanly for repeat opens
    if (acknowledgedNote) {
      acknowledgedNote.classList.remove('is-visible');
    }
    if (acknowledgeBtn) {
      acknowledgeBtn.textContent = 'I Understand 🤍';
    }
    // Force reflow so the warning badge & curtain intro replays from 0% every time
    warningModal.classList.remove('is-open');
    void warningModal.offsetWidth;
    warningModal.classList.add('is-open');
    warningModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeWarningModal() {
    if (!warningModal) return;
    warningModal.classList.remove('is-open');
    warningModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Wire up events
  if (musicToggle) {
    musicToggle.addEventListener('click', toggleMusic);
  }

  if (luxuryEnvelope) {
    luxuryEnvelope.addEventListener('click', openSaveTheDate);
    luxuryEnvelope.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSaveTheDate();
      }
    });
  } else if (openCardBtn) {
    openCardBtn.addEventListener('click', openSaveTheDate);
  }

  if (closeCardBtn) {
    closeCardBtn.addEventListener('click', openWarningModal);
  }

  if (doneViewingBtn) {
    doneViewingBtn.addEventListener('click', openWarningModal);
  }

  if (backToCardBtn) {
    backToCardBtn.addEventListener('click', closeWarningModal);
  }

  if (acknowledgeBtn) {
    acknowledgeBtn.addEventListener('click', () => {
      if (acknowledgedNote) {
        acknowledgedNote.classList.add('is-visible');
      }
      acknowledgeBtn.textContent = 'Thank You 🤍';
      setTimeout(() => {
        closeWarningModal();
      }, 1100);
    });
  }

  // Close warning modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && warningModal && warningModal.classList.contains('is-open')) {
      closeWarningModal();
    }
  });
});
