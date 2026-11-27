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
  const panelMiddle = stdCardFrame ? stdCardFrame.querySelector('.trifold-panel--middle') : null;
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
  const AUTO_OPEN_DELAY_MS = 1000;
  const UNFOLD_SETTLE_MS = 6400;
  // Total fade-in from start (0ms) to letter completely opened (1000ms delay + 6400ms open & 2-stage unfold = 7400ms)
  const FADE_IN_DURATION_MS = AUTO_OPEN_DELAY_MS + UNFOLD_SETTLE_MS;
  const FADE_OUT_DURATION_MS = 800;
  // Start at 0:41.0 ("Everything makes perfect sense with you...") so the 7.4s fade-in & unfold
  // lands right on the 0:48.2 chorus drop ("With my arms wide open") at full target volume
  const MUSIC_START_TIME_SEC = 41.0;
  let initialSeekApplied = false;

  function applyInitialStartTime() {
    if (!bgMusic || initialSeekApplied || bgMusic.readyState < 1) return;
    const duration = bgMusic.duration;
    const targetTime = (Number.isFinite(duration) && duration > 0 && duration <= MUSIC_START_TIME_SEC)
      ? 0
      : MUSIC_START_TIME_SEC;

    let seekable = false;
    if (bgMusic.seekable) {
      for (let i = 0; i < bgMusic.seekable.length; i++) {
        if (targetTime >= bgMusic.seekable.start(i) && targetTime <= bgMusic.seekable.end(i)) {
          seekable = true;
          break;
        }
      }
    }
    if (!seekable && bgMusic.readyState < 3) return;

    try {
      bgMusic.currentTime = targetTime;
      if (bgMusic.seeking || Math.abs(bgMusic.currentTime - targetTime) < 1.5) {
        initialSeekApplied = true;
      }
    } catch (_) {
      // Defer until canplay/playing if media is not yet seekable
    }
  }

  // Ensure initial audio volume is 0, initial start offset (41.0s) is queued, and end-of-track loop is active
  if (bgMusic) {
    bgMusic.volume = 0;
    bgMusic.loop = true;
    applyInitialStartTime();
    if (!initialSeekApplied) {
      bgMusic.addEventListener('loadedmetadata', applyInitialStartTime, { once: true });
      bgMusic.addEventListener('canplay', applyInitialStartTime, { once: true });
      bgMusic.addEventListener('playing', applyInitialStartTime, { once: true });
    }
    bgMusic.addEventListener('ended', () => {
      bgMusic.currentTime = 0;
      bgMusic.play().catch(() => {});
    });
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
      const elapsed = Math.max(0, now - startTime);
      const progress = Math.max(0, Math.min(1, elapsed / durationMs));
      // Smooth perceptual curve: starts soft on load, swells through the 4.5s seal delay, and reaches full hearable volume as the letter finishes unfolding
      const eased = rising
        ? Math.pow(progress, 1.8)
        : 1 - Math.pow(1 - progress, 2);

      const rawVol = fromVol + (toVol - fromVol) * eased;
      const currentVol = Number.isFinite(rawVol) ? Math.max(0, Math.min(1, rawVol)) : toVol;
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
    applyInitialStartTime();

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
          applyInitialStartTime();
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
    const cardW = stdCardFrame.offsetWidth || 390;
    const h1 = panelTop.offsetHeight || 378;
    const h2 = panelMiddle ? (panelMiddle.offsetHeight || 178) : 178;
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

    stdCardFrame.style.setProperty('--panel-middle-h', `${h2}px`);
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

    // 2. Phase 1 (0ms): Dissolve wax seal & slowly flip 3D envelope flap open
    if (unifiedStage) {
      unifiedStage.classList.add('phase-flap');
    }

    // 3. Phase 2 (900ms): The real folded 3-panel letter rises slowly out of the envelope as the envelope glides down
    setTimeout(() => {
      if (unifiedStage) {
        unifiedStage.classList.add('phase-pull');
      }
    }, 900);

    // 4. Phase 3A — 1st Unfold (2500ms): Top panel unfolds upward (revealing SAVE OUR DATE + Photo) while Panel 3 still covers the middle panel!
    setTimeout(() => {
      if (unifiedStage) {
        unifiedStage.classList.add('phase-unfold');
      }
      if (stdCardFrame) {
        stdCardFrame.setAttribute('aria-hidden', 'false');
      }
    }, 2500);

    // 5. Phase 3B — 2nd Unfold (4350ms): Bottom panel unfolds downward, revealing BOTH the middle (Riggo AND Ivy + Date) and bottom (Attire + Monogram) sections!
    setTimeout(() => {
      if (unifiedStage) {
        unifiedStage.classList.add('phase-unfold-2');
      }
    }, 4350);

    // 6. Phase 4 (6400ms): Unified flat letter settles with soft paper shadow as music reaches full target volume
    setTimeout(() => {
      if (unifiedStage) {
        unifiedStage.classList.add('phase-settled');
      }
    }, UNFOLD_SETTLE_MS);
  }

  // Start the music fade-in and the exact 1-second (1000ms) auto-open timer immediately once DOM & fonts are ready
  // (using a 500ms cap on fonts.ready so media buffering never adds extra startup delay!)
  let autoSequenceStarted = false;
  function startAutoOpenSequenceOnFullLoad() {
    if (autoSequenceStarted) return;
    autoSequenceStarted = true;

    const fontsReady = (document.fonts && document.fonts.ready)
      ? Promise.race([
          document.fonts.ready.catch(() => {}),
          new Promise((res) => setTimeout(res, 500))
        ])
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

  startAutoOpenSequenceOnFullLoad();

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
    warningModal.classList.remove('is-open', 'is-closing');
    void warningModal.offsetWidth;
    warningModal.classList.add('is-open');
    warningModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeWarningModal() {
    if (!warningModal) return;
    if (warningModal.contains(document.activeElement)) {
      if (doneViewingBtn && typeof doneViewingBtn.focus === 'function') {
        doneViewingBtn.focus({ preventScroll: true });
      } else if (typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    }
    warningModal.classList.add('is-closing');
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
    acknowledgeBtn.addEventListener('click', closeWarningModal);
  }

  // Close warning modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && warningModal && warningModal.classList.contains('is-open')) {
      closeWarningModal();
    }
  });
});
