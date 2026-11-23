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
  // Gentle mid-low target volume (32%) so music never blasts on open
  let userVolume = 0.32;
  let lastNonZeroVolume = 0.32;
  const FADE_IN_DURATION_MS = 4200;
  const FADE_OUT_DURATION_MS = 650;

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
  }

  function fadeVolume(fromVol, toVol, durationMs, onComplete) {
    if (!bgMusic) return;
    cancelFade();
    const startTime = performance.now();
    bgMusic.volume = Math.max(0, Math.min(1, fromVol));

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Cubic ease-in-out so the start stays very soft and swells smoothly to mid volume
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentVol = Math.max(0, Math.min(1, fromVol + (toVol - fromVol) * eased));
      bgMusic.volume = currentVol;
      syncSliderUI(currentVol);

      if (progress < 1) {
        fadeRafId = requestAnimationFrame(step);
      } else {
        fadeRafId = null;
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

  function startMusicWithGentleFadeIn() {
    if (!bgMusic) return;
    cancelFade();
    bgMusic.volume = 0;
    syncSliderUI(0);

    const target = userVolume > 0 ? userVolume : lastNonZeroVolume;
    const playPromise = bgMusic.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          updateMusicUI(true);
          fadeVolume(0, target, FADE_IN_DURATION_MS);
        })
        .catch(() => updateMusicUI(false));
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
  window.addEventListener('load', syncLetterGeometry);
  window.addEventListener('resize', () => {
    if (!isOpened) syncLetterGeometry();
  });

  function openSaveTheDate() {
    if (isOpened) return;
    syncLetterGeometry();
    isOpened = true;

    // 1. Start gentle low-to-mid background music fade-in immediately
    startMusicWithGentleFadeIn();

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

    // 5. Phase 4 (2750ms): Unified flat letter settles with soft paper shadow
    setTimeout(() => {
      if (unifiedStage) {
        unifiedStage.classList.add('phase-settled');
      }
    }, 2750);
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
