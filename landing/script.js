// ===== SCROLL REVEAL =====
const revealElements = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

revealElements.forEach(el => revealObserver.observe(el));

// ===== NAV SCROLL EFFECT =====
const nav = document.getElementById('nav');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const currentScroll = window.scrollY;
  if (currentScroll > 60) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
  lastScroll = currentScroll;
}, { passive: true });

// ===== COUNTER ANIMATION =====
const counters = document.querySelectorAll('[data-count]');

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const target = parseInt(entry.target.dataset.count);
      animateCounter(entry.target, target);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

counters.forEach(el => counterObserver.observe(el));

function animateCounter(el, target) {
  const duration = 1800;
  const start = performance.now();

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = Math.floor(eased * target);

    el.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = target;
      // Add suffix based on label
      const label = el.parentElement.querySelector('.label').textContent;
      if (label.includes('%')) {
        el.textContent = target + '%';
      } else if (label.includes('min')) {
        el.textContent = '<' + target;
      }
    }
  }

  requestAnimationFrame(update);
}

// ===== FAQ ACCORDION =====
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const wasOpen = item.classList.contains('open');

    // Close all
    document.querySelectorAll('.faq-item.open').forEach(openItem => {
      openItem.classList.remove('open');
    });

    // Toggle clicked
    if (!wasOpen) {
      item.classList.add('open');
    }
  });
});

// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ===== WAITLIST FORM =====
const form = document.getElementById('waitlist-form');
const successMsg = document.getElementById('form-success');
const errorMsg = document.getElementById('form-error');
const waitlistEndpoint = form.dataset.waitlistEndpoint || window.RV_WAITLIST_ENDPOINT || '';
const fallbackEmail = form.dataset.waitlistFallbackEmail || 'hello@rentalvoice.app';

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const emailInput = form.querySelector('input[type="email"]');
  const email = emailInput.value.trim();

  successMsg.style.display = 'none';
  errorMsg.style.display = 'none';

  if (!waitlistEndpoint) {
    errorMsg.textContent = `The waitlist form is not connected yet. Email ${fallbackEmail} to join manually.`;
    errorMsg.style.display = 'block';
    return;
  }

  fetch(waitlistEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      source: 'landing',
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Waitlist endpoint returned ${response.status}`);
      }
      form.style.display = 'none';
      successMsg.textContent = "Thanks - we received your request.";
      successMsg.style.display = 'block';
    })
    .catch((error) => {
      console.error('[Waitlist] Submission failed:', error);
      errorMsg.textContent = `We could not submit the waitlist form. Email ${fallbackEmail} to join manually.`;
      errorMsg.style.display = 'block';
    });
});
