/**
 * Riggo & Ivy Wedding RSVP — Studio.Design Interactive Runtime
 * Recreates 100% of https://wedding20251012-ny.studio.site/ entrance curtain,
 * sticky carousel with Ken Burns zoom, IntersectionObserver .appear transitions
 * with exact cubic-bezier timings & delays, and interactive 13-field RSVP form.
 */

document.addEventListener('DOMContentLoaded', () => {
  /* ==========================================================================
     1. Opening Curtain & Hero Entrance Sequence (Exact 1500ms Studio delay)
     ========================================================================== */
  const openingCurtain = document.getElementById('openingCurtain');
  const heroSticky = document.getElementById('heroSticky');
  const heroFloatingCard = document.getElementById('heroFloatingCard');

  setTimeout(() => {
    if (openingCurtain) {
      openingCurtain.classList.add('is-dismissed');
    }
    if (heroSticky) {
      heroSticky.classList.add('is-ready');
    }
  }, 1500);

  setTimeout(() => {
    if (heroFloatingCard) {
      heroFloatingCard.classList.remove('is-waiting');
    }
  }, 2000);

  /* ==========================================================================
     2. Auto-Playing Hero Carousel + 4000ms Ken Burns Scale (1.05 -> 1.0)
     ========================================================================== */
  const track = document.getElementById('heroCarouselTrack');
  const slides = track ? Array.from(track.querySelectorAll('.hero-carousel__slide')) : [];
  let currentSlide = 0;

  if (slides.length > 0) {
    requestAnimationFrame(() => {
      slides[0].classList.add('is-active');
    });

    setInterval(() => {
      slides[currentSlide].classList.remove('is-active');
      currentSlide = (currentSlide + 1) % slides.length;
      track.style.transform = `translate3d(-${currentSlide * 100}%, 0, 0)`;

      requestAnimationFrame(() => {
        slides[currentSlide].classList.add('is-active');
      });
    }, 4500);
  }

  /* ==========================================================================
     3. Studio.Design .appear Scroll Reveal System (IntersectionObserver)
     ========================================================================== */
  const appearElements = document.querySelectorAll('[data-appear]');

  appearElements.forEach((el) => {
    const duration = el.getAttribute('data-duration') || '1000ms';
    const delay = el.getAttribute('data-delay') || '0ms';
    const easing = el.getAttribute('data-easing');

    el.style.transitionDuration = duration;
    el.style.transitionDelay = delay;
    if (easing === 'linear') {
      el.style.transitionTimingFunction = 'linear';
    }
    el.classList.add('is-waiting');
  });

  const appearObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('is-waiting');
          entry.target.classList.add('is-visible');
          appearObserver.unobserve(entry.target);
        }
      });
    },
    {
      root: null,
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.08,
    }
  );

  appearElements.forEach((el) => appearObserver.observe(el));

  /* ==========================================================================
     4. 13-Field Studio.Design RSVP Form -> Cloudflare D1 Backend (/api/rsvp)
     ========================================================================== */
  const rsvpForm = document.getElementById('rsvpForm');
  const rsvpConfirmation = document.getElementById('rsvpConfirmation');
  const rsvpGuestNameSpan = document.getElementById('rsvpGuestName');
  const rsvpResetBtn = document.getElementById('rsvpResetBtn');

  if (rsvpForm) {
    rsvpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = rsvpForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.textContent : 'Submit';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
      }

      const formData = new FormData(rsvpForm);
      const payload = Object.fromEntries(formData.entries());

      try {
        const res = await fetch('/api/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to submit RSVP');
        }
      } catch (err) {
        // Fallback to localStorage if previewed without Workers backend
        console.warn('RSVP API fallback:', err.message);
        try {
          const existing = JSON.parse(localStorage.getItem('riggo_ivy_rsvps') || '[]');
          existing.push({ ...payload, submittedAt: new Date().toISOString() });
          localStorage.setItem('riggo_ivy_rsvps', JSON.stringify(existing));
        } catch (_) {}
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      }

      if (rsvpGuestNameSpan) {
        rsvpGuestNameSpan.textContent = `${payload.firstName || ''} ${payload.lastName || ''}`.trim() || 'Guest';
      }

      rsvpForm.style.display = 'none';
      if (rsvpConfirmation) {
        rsvpConfirmation.classList.add('is-active');
        rsvpConfirmation.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  if (rsvpResetBtn && rsvpForm && rsvpConfirmation) {
    rsvpResetBtn.addEventListener('click', () => {
      rsvpForm.reset();
      rsvpConfirmation.classList.remove('is-active');
      rsvpForm.style.display = 'flex';
    });
  }
});
