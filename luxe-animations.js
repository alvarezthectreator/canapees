/**
 * ============================================================
 *  LUXE CANAPÉS  Sophisticated Animation Engine
 *  Covers: header, hero, sections, images, text, scroll FX
 * ============================================================
 */

/* ─────────────────────────────────────────────────────────────
   0.  UTILITY HELPERS
───────────────────────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const lerp = (a, b, t) => a + (b - a) * t;
const map = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);

/* ─────────────────────────────────────────────────────────────
   1.  INJECT ANIMATION STYLESHEET (runs before DOM animations)
───────────────────────────────────────────────────────────── */
(function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
    /* ── Base hidden state for scroll-reveal ── */
    [data-anim] { will-change: transform, opacity; }

    /* ── Fade up ── */
    .anim-fade-up   { opacity: 0; transform: translateY(48px); transition: opacity .8s cubic-bezier(.16,1,.3,1), transform .8s cubic-bezier(.16,1,.3,1); }
    .anim-fade-up.visible { opacity: 1; transform: translateY(0); }

    /* ── Fade in ── */
    .anim-fade-in   { opacity: 0; transition: opacity 1s ease; }
    .anim-fade-in.visible { opacity: 1; }

    /* ── Slide from left ── */
    .anim-slide-left  { opacity: 0; transform: translateX(-60px); transition: opacity .9s cubic-bezier(.16,1,.3,1), transform .9s cubic-bezier(.16,1,.3,1); }
    .anim-slide-left.visible { opacity: 1; transform: translateX(0); }

    /* ── Slide from right ── */
    .anim-slide-right { opacity: 0; transform: translateX(60px); transition: opacity .9s cubic-bezier(.16,1,.3,1), transform .9s cubic-bezier(.16,1,.3,1); }
    .anim-slide-right.visible { opacity: 1; transform: translateX(0); }

    /* ── Scale pop ── */
    .anim-scale-pop  { opacity: 0; transform: scale(.85); transition: opacity .7s cubic-bezier(.34,1.56,.64,1), transform .7s cubic-bezier(.34,1.56,.64,1); }
    .anim-scale-pop.visible { opacity: 1; transform: scale(1); }

    /* ── 3D flip card ── */
    .anim-flip-3d    { opacity: 0; transform: perspective(900px) rotateY(25deg) scale(.92); transition: opacity .9s cubic-bezier(.16,1,.3,1), transform .9s cubic-bezier(.16,1,.3,1); }
    .anim-flip-3d.visible { opacity: 1; transform: perspective(900px) rotateY(0deg) scale(1); }

    /* ── Clip wipe ── */
    .anim-wipe {
      clip-path: inset(0 100% 0 0);
      transition: clip-path 1s cubic-bezier(.77,0,.18,1);
    }
    .anim-wipe.visible { clip-path: inset(0 0% 0 0); }

    /* ── Text character spans ── */
    .char-wrap { overflow: hidden; display: inline-block; }
    .char      { display: inline-block; opacity: 0; transform: translateY(110%); transition: opacity .5s ease, transform .5s cubic-bezier(.16,1,.3,1); }
    .char.visible { opacity: 1; transform: translateY(0); }

    /* ── Word spans ── */
    .word-wrap { overflow: hidden; display: inline-block; }
    .word      { display: inline-block; opacity: 0; transform: translateY(100%); transition: opacity .6s ease, transform .6s cubic-bezier(.16,1,.3,1); }
    .word.visible { opacity: 1; transform: translateY(0); }

    /* ── Pill bounce-in ── */
    .pill-anim { opacity: 0; transform: scale(.7) translateY(20px); transition: opacity .5s ease, transform .5s cubic-bezier(.34,1.56,.64,1); }
    .pill-anim.visible { opacity: 1; transform: scale(1) translateY(0); }

    /* ── Gold underline draw ── */
    .gold-line { position: relative; display: inline-block; }
    .gold-line::after {
      content: '';
      position: absolute;
      bottom: -4px; left: 0;
      width: 0; height: 2px;
      background: #C9A84C;
      transition: width 1s cubic-bezier(.77,0,.18,1);
    }
    .gold-line.visible::after { width: 100%; }

    /* ── Image 3D tilt wrapper ── */
    .tilt-card { transform-style: preserve-3d; transition: transform .1s ease; }
    .tilt-card img { display: block; }

    /* ── Magnetic button ── */
    .btn { transition: transform .3s cubic-bezier(.34,1.56,.64,1), box-shadow .3s ease !important; }

    /* ── Parallax image container ── */
    .parallax-img { overflow: hidden; }
    .parallax-img img { transform-origin: center; will-change: transform; transition: transform .05s linear; }

    /* ── Number counter ── */
    .count-up { font-variant-numeric: tabular-nums; }

    /* ── Hero text animated entrance ── */
    .hero-tag, .hero-desc, .hero .btn-gold {
      opacity: 0;
      transform: translateY(40px);
    }

    /* ── top-bar slide down ── */
    .top-bar {
      opacity: 0;
      transform: translateY(-100%);
      transition: opacity .6s ease, transform .6s cubic-bezier(.16,1,.3,1);
    }
    .top-bar.loaded { opacity: 1; transform: translateY(0); }

    /* ── header slide down ── */
    .site-header {
      opacity: 0;
      transform: translateY(-20px);
      transition: opacity .7s ease .2s, transform .7s cubic-bezier(.16,1,.3,1) .2s;
    }
    .site-header.loaded { opacity: 1; transform: translateY(0); }

    /* ── nav items stagger ── */
    .main-nav li {
      opacity: 0;
      transform: translateY(-12px);
      transition: opacity .5s ease, transform .5s cubic-bezier(.16,1,.3,1);
    }
    .main-nav li.loaded { opacity: 1; transform: translateY(0); }

    /* ── logo entrance ── */
    .logo img {
      opacity: 0;
      transform: scale(.8) rotate(-4deg);
      transition: opacity .8s ease .1s, transform .8s cubic-bezier(.34,1.56,.64,1) .1s;
    }
    .logo img.loaded { opacity: 1; transform: scale(1) rotate(0deg); }

    /* ── header CTA ── */
    .header-cta {
      opacity: 0;
      transform: translateX(20px);
      transition: opacity .7s ease .5s, transform .7s cubic-bezier(.16,1,.3,1) .5s;
    }
    .header-cta.loaded { opacity: 1; transform: translateX(0); }

    /* ── hero background ken-burns ── */
    @media (min-width: 769px) {
        .hero { background-size: 120% !important; animation: kenBurns 18s ease-in-out infinite alternate; }
        @keyframes kenBurns {
          0%   { background-size: 110%; background-position: 60% 40%; }
          100% { background-size: 125%; background-position: 45% 55%; }
        }

    /* ── hero overlay gradient pulse ── */
    .hero::before {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(0,0,0,.65) 0%, rgba(201,168,76,.08) 100%);
      animation: overlayPulse 6s ease-in-out infinite alternate;
      z-index: 0;
    }
    @keyframes overlayPulse {
      0%   { opacity: .8; }
      100% { opacity: 1; }
    }
    .hero { position: relative; }
    .hero-content { position: relative; z-index: 1; }

    /* ── floating gold orbs (hero decoration) ── */
    .hero-orb {
      position: absolute; border-radius: 50%;
      background: radial-gradient(circle, rgba(201,168,76,.25) 0%, transparent 70%);
      pointer-events: none; z-index: 0;
      animation: orbFloat linear infinite;
    }
    @keyframes orbFloat {
      0%   { transform: translateY(0) scale(1); opacity: .6; }
      50%  { transform: translateY(-30px) scale(1.08); opacity: .9; }
      100% { transform: translateY(0) scale(1); opacity: .6; }
    }

    /* ── testimonial card shimmer ── */
    .testimonial-card {
      position: relative;
      overflow: hidden;
    }
    .testimonial-card::after {
      content: '';
      position: absolute; top: 0; left: -100%;
      width: 60%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(201,168,76,.08), transparent);
      animation: shimmer 3.5s ease-in-out infinite;
    }
    @keyframes shimmer {
      0%   { left: -100%; }
      100% { left: 160%; }
    }

    /* ── gallery strip hover ── */
    .gallery-track img {
      transition: transform .5s cubic-bezier(.34,1.56,.64,1), filter .5s ease, box-shadow .5s ease;
    }
    .gallery-track img:hover {
      transform: scale(1.08) translateY(-6px) rotate(1deg) !important;
      filter: brightness(1.1) saturate(1.2);
      box-shadow: 0 20px 40px rgba(0,0,0,.35);
      z-index: 2;
    }

    /* ── product item hover 3D ── */
    .product-item {
      transition: transform .4s cubic-bezier(.34,1.56,.64,1), box-shadow .4s ease;
    }
    .product-item:hover {
      transform: translateY(-4px) scale(1.02);
      box-shadow: 0 12px 30px rgba(0,0,0,.15);
    }
    .product-thumb {
      transition: transform .5s cubic-bezier(.34,1.56,.64,1);
    }
    .product-item:hover .product-thumb {
      transform: scale(1.08) rotate(-1deg);
    }

    /* ── menu-text-list item pop ── */
    .menu-text-list span {
      transition: transform .3s cubic-bezier(.34,1.56,.64,1), color .3s ease, letter-spacing .3s ease;
      display: inline-block;
    }
    .menu-text-list span:hover {
      transform: translateX(6px) scale(1.04);
      color: #C9A84C;
      letter-spacing: .04em;
    }

    /* ── checklist item reveal ── */
    .check-list li {
      opacity: 0; transform: translateX(-20px);
      transition: opacity .5s ease, transform .5s cubic-bezier(.16,1,.3,1);
    }
    .check-list li.visible { opacity: 1; transform: translateX(0); }

    /* ── contact form inputs focus glow ── */
    .contact-form input,
    .contact-form textarea {
      transition: border-color .3s ease, box-shadow .3s ease, transform .3s ease;
    }
    .contact-form input:focus,
    .contact-form textarea:focus {
      box-shadow: 0 0 0 3px rgba(201,168,76,.2);
      transform: scale(1.01);
    }

    /* ── image event gallery 3D grid ── */
    .event-gallery img {
      transition: transform .5s cubic-bezier(.34,1.56,.64,1), filter .5s ease, box-shadow .5s ease;
    }
    .event-gallery img:hover {
      transform: scale(1.06) rotate(-1deg) translateY(-4px);
      filter: brightness(1.08) saturate(1.15);
      box-shadow: 0 16px 40px rgba(0,0,0,.3);
      z-index: 2;
      position: relative;
    }

    /* ── who-images tilt perspective ── */
    .who-images {
      perspective: 800px;
    }
    .who-images img {
      transition: transform .6s cubic-bezier(.16,1,.3,1), box-shadow .6s ease;
    }
    .who-images img:hover {
      transform: rotateY(-6deg) rotateX(3deg) scale(1.04);
      box-shadow: 12px 20px 40px rgba(0,0,0,.25);
    }

    /* ── about image 3D hover ── */
    .about-image {
      perspective: 900px;
    }
    .about-image img {
      transition: transform .6s cubic-bezier(.16,1,.3,1), box-shadow .6s ease;
    }
    .about-image img:hover {
      transform: rotateY(8deg) rotateX(-3deg) scale(1.03);
      box-shadow: -14px 18px 40px rgba(0,0,0,.25);
    }

    /* ── scroll progress bar ── */
    #scroll-progress {
      position: fixed; top: 0; left: 0;
      width: 0%; height: 3px;
      background: linear-gradient(90deg, #C9A84C, #f0d080, #C9A84C);
      background-size: 200% 100%;
      z-index: 9999;
      animation: progressShine 2s linear infinite;
      transition: width .1s linear;
    }
    @keyframes progressShine {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── section divider animated line ── */
    .section-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #C9A84C, transparent);
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 1.2s cubic-bezier(.77,0,.18,1);
    }
    .section-divider.visible { transform: scaleX(1); }

    /* ── cursor custom ── */
    #custom-cursor {
      position: fixed; pointer-events: none; z-index: 99999;
      width: 12px; height: 12px;
      background: #C9A84C;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      transition: transform .1s ease, width .3s ease, height .3s ease, background .3s ease;
      mix-blend-mode: difference;
    }
    #cursor-ring {
      position: fixed; pointer-events: none; z-index: 99998;
      width: 40px; height: 40px;
      border: 1.5px solid rgba(201,168,76,.6);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      transition: transform .12s ease, width .3s ease, height .3s ease, opacity .3s ease;
    }
    body:hover #custom-cursor { opacity: 1; }

    /* ── footer brand reveal ── */
    .footer-brand { opacity: 0; transform: translateY(30px); transition: opacity .8s ease, transform .8s cubic-bezier(.16,1,.3,1); }
    .footer-brand.visible { opacity: 1; transform: translateY(0); }
    .footer-col { opacity: 0; transform: translateY(20px); transition: opacity .7s ease, transform .7s cubic-bezier(.16,1,.3,1); }
    .footer-col.visible { opacity: 1; transform: translateY(0); }

    /* ── magnetic hover area ── */
    .btn-gold, .btn-primary { overflow: hidden; }
    .btn-gold::before, .btn-primary::before {
      content: '';
      position: absolute; top: 50%; left: 50%;
      width: 0; height: 0;
      background: rgba(255,255,255,.12);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      transition: width .6s ease, height .6s ease, opacity .6s ease;
      opacity: 0;
    }
    .btn-gold:hover::before, .btn-primary:hover::before {
      width: 200%; height: 200%;
      opacity: 1;
    }
    .btn-gold { position: relative; }
    .btn-primary { position: relative; }

  `;
    document.head.appendChild(style);
})();


/* ─────────────────────────────────────────────────────────────
   2.  SCROLL PROGRESS BAR
───────────────────────────────────────────────────────────── */
function initScrollProgress() {
    const bar = document.createElement('div');
    bar.id = 'scroll-progress';
    document.body.prepend(bar);

    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        const total = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = clamp((scrolled / total) * 100, 0, 100) + '%';
    }, { passive: true });
}


/* ─────────────────────────────────────────────────────────────
   3.  CUSTOM CURSOR
───────────────────────────────────────────────────────────── */
function initCustomCursor() {
    if (window.matchMedia('(pointer: coarse)').matches) return; // skip on touch

    const cursor = document.createElement('div');
    cursor.id = 'custom-cursor';
    const ring = document.createElement('div');
    ring.id = 'cursor-ring';
    document.body.append(cursor, ring);

    let cx = 0,
        cy = 0,
        rx = 0,
        ry = 0;

    document.addEventListener('mousemove', e => {
        cx = e.clientX;
        cy = e.clientY;
        cursor.style.left = cx + 'px';
        cursor.style.top = cy + 'px';
    });

    // Lag ring follows with lerp
    (function animRing() {
        rx = lerp(rx, cx, 0.12);
        ry = lerp(ry, cy, 0.12);
        ring.style.left = rx + 'px';
        ring.style.top = ry + 'px';
        requestAnimationFrame(animRing);
    })();

    // Hover states
    const hoverEls = $$('a, button, .btn, .pill, .product-item');
    hoverEls.forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursor.style.width = '20px';
            cursor.style.height = '20px';
            cursor.style.background = '#f0d080';
            ring.style.width = '60px';
            ring.style.height = '60px';
            ring.style.opacity = '.4';
        });
        el.addEventListener('mouseleave', () => {
            cursor.style.width = '12px';
            cursor.style.height = '12px';
            cursor.style.background = '#C9A84C';
            ring.style.width = '40px';
            ring.style.height = '40px';
            ring.style.opacity = '1';
        });
    });
}


/* ─────────────────────────────────────────────────────────────
   4.  HEADER ENTRANCE (top-bar, logo, nav, cta)
───────────────────────────────────────────────────────────── */
function initHeaderEntrance() {
    // top-bar
    const topBar = $('.top-bar');
    if (topBar) setTimeout(() => topBar.classList.add('loaded'), 50);

    // header
    const header = $('.site-header');
    if (header) setTimeout(() => header.classList.add('loaded'), 150);

    // logo
    const logoImg = $('.logo img');
    if (logoImg) setTimeout(() => logoImg.classList.add('loaded'), 200);

    // nav items staggered
    $$('.main-nav li').forEach((li, i) => {
        setTimeout(() => li.classList.add('loaded'), 300 + i * 80);
    });

    // header CTA
    const cta = $('.header-cta');
    if (cta) setTimeout(() => cta.classList.add('loaded'), 700);
}


/* ─────────────────────────────────────────────────────────────
   5.  HERO SECTION ANIMATIONS
───────────────────────────────────────────────────────────── */
function initHeroAnimations() {
    const tag = $('.hero-tag');
    const desc = $('.hero-desc');
    const btn = $('.hero .btn-gold');

    if (tag) animateIn(tag, 600, 'translateY(50px)', 'translateY(0)');
    if (desc) animateIn(desc, 900, 'translateY(40px)', 'translateY(0)');
    if (btn) animateIn(btn, 1200, 'translateY(30px)', 'translateY(0)');

    function animateIn(el, delay, fromTransform, toTransform) {
        el.style.opacity = '0';
        el.style.transform = fromTransform;
        el.style.transition = `opacity .9s cubic-bezier(.16,1,.3,1), transform .9s cubic-bezier(.16,1,.3,1)`;
        setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = toTransform;
        }, delay);
    }

    // Inject gold floating orbs into hero
    const hero = $('.hero');
    if (!hero) return;
    const orbs = [
        { w: 300, h: 300, t: '10%', l: '5%', dur: '9s', delay: '0s' },
        { w: 200, h: 200, t: '60%', l: '80%', dur: '13s', delay: '2s' },
        { w: 150, h: 150, t: '30%', l: '55%', dur: '11s', delay: '1s' },
    ];
    orbs.forEach(o => {
        const orb = document.createElement('div');
        orb.className = 'hero-orb';
        Object.assign(orb.style, {
            width: o.w + 'px',
            height: o.h + 'px',
            top: o.t,
            left: o.l,
            animationDuration: o.dur,
            animationDelay: o.delay,
        });
        hero.appendChild(orb);
    });
}


/* ─────────────────────────────────────────────────────────────
   6.  SCROLL-TRIGGERED REVEAL  IntersectionObserver
───────────────────────────────────────────────────────────── */
function initScrollReveal() {
    // Assign animation classes to sections/elements
    const assignments = [
        // About
        ['.about-image', 'anim-flip-3d'],
        ['.about-text h2', 'anim-slide-left'],
        ['.about-text p', 'anim-fade-up'],
        ['.about-text .btn', 'anim-scale-pop'],
        ['.feature-list li', 'anim-fade-up'],

        // Who we are
        ['.who-text h2', 'anim-slide-left'],
        ['.who-text p', 'anim-fade-up'],
        ['.who-images img', 'anim-flip-3d'],

        // Menu
        ['.section-header', 'anim-fade-up'],
        ['.menu-image', 'anim-slide-left'],
        ['.menu-category', 'anim-fade-up'],
        ['.product-item', 'anim-scale-pop'],

        // Event
        ['.event-text h2', 'anim-slide-left'],
        ['.event-text p', 'anim-fade-up'],
        ['.event-gallery img', 'anim-scale-pop'],

        // Testimonials
        ['.testimonial-card', 'anim-scale-pop'],

        // Contact
        ['.contact-text h2', 'anim-slide-left'],
        ['.contact-form', 'anim-slide-right'],

        // Footer
        ['.footer-brand', 'anim-fade-up'],
        ['.footer-col', 'anim-fade-up'],

        // Sub-labels
        ['.sub-label', 'anim-wipe'],
    ];

    assignments.forEach(([sel, cls]) => {
        $$(sel).forEach(el => {
            if (!el.classList.contains(cls)) el.classList.add(cls);
        });
    });

    // Stagger siblings
    function applyStagger(parentSel, childSel, baseDelay = 0, step = 120) {
        $$(parentSel).forEach(parent => {
            $$(childSel, parent).forEach((child, i) => {
                child.style.transitionDelay = (baseDelay + i * step) + 'ms';
            });
        });
    }
    applyStagger('.feature-list', 'li', 0, 100);
    applyStagger('.menu-categories', '.menu-category', 0, 150);
    applyStagger('.product-list', '.product-item', 0, 80);
    applyStagger('.event-gallery', 'img', 0, 80);
    applyStagger('.who-images', 'img', 0, 200);
    applyStagger('.footer-grid', '.footer-col', 0, 120);

    // Observe
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    const animClasses = [
        'anim-fade-up', 'anim-fade-in', 'anim-slide-left', 'anim-slide-right',
        'anim-scale-pop', 'anim-flip-3d', 'anim-wipe', 'section-divider',
        'footer-brand', 'footer-col'
    ];
    animClasses.forEach(cls => {
        $$(`.${cls}`).forEach(el => io.observe(el));
    });
}


/* ─────────────────────────────────────────────────────────────
   7.  OFFER PILLS  staggered bounce-in
───────────────────────────────────────────────────────────── */
function initPills() {
    const pills = $$('.pill');
    pills.forEach(p => p.classList.add('pill-anim'));

    const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                pills.forEach((p, i) => {
                    setTimeout(() => p.classList.add('visible'), i * 100);
                });
                io.disconnect();
            }
        });
    }, { threshold: 0.3 });

    const strip = $('.offer-strip');
    if (strip) io.observe(strip);
}


/* ─────────────────────────────────────────────────────────────
   8.  TEXT SPLITTING  hero tag word-by-word
───────────────────────────────────────────────────────────── */
function initTextSplit() {
    // Split hero-tag into word spans for staggered reveal
    const tag = $('.hero-tag');
    if (!tag) return;

    // hero-tag is already animated as a block, so do hero-desc words
    const desc = $('.hero-desc');
    if (!desc) return;

    const words = desc.textContent.trim().split(/\s+/);
    desc.innerHTML = words
        .map(w => `<span class="word-wrap"><span class="word">${w}&nbsp;</span></span>`)
        .join('');

    setTimeout(() => {
        $$('.word', desc).forEach((w, i) => {
            setTimeout(() => w.classList.add('visible'), 950 + i * 50);
        });
    }, 0);
}


/* ─────────────────────────────────────────────────────────────
   9.  CHECK-LIST STAGGERED REVEAL
───────────────────────────────────────────────────────────── */
function initCheckList() {
    const items = $$('.check-list li');
    const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                items.forEach((li, i) => {
                    setTimeout(() => li.classList.add('visible'), i * 120);
                });
                io.disconnect();
            }
        });
    }, { threshold: 0.2 });

    const section = $('.event-section');
    if (section) io.observe(section);
}


/* ─────────────────────────────────────────────────────────────
   10. PARALLAX  hero background + about/who images
───────────────────────────────────────────────────────────── */
function initParallax() {
    const hero = $('.hero');

    window.addEventListener('scroll', () => {
        const sy = window.scrollY;

        // Hero parallax (subtle background-position shift)
        if (hero && window.innerWidth > 768) {
            const speed = 0.25;
            hero.style.backgroundPositionY = `calc(50% + ${sy * speed}px)`;
        }

        // About image parallax
        const aboutImg = $('.about-image img');
        if (aboutImg) {
            const rect = aboutImg.closest('.about-image').getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
                const shift = map(progress, 0, 1, -20, 20);
                aboutImg.style.transform = `translateY(${shift}px)`;
            }
        }

    }, { passive: true });
}


/* ─────────────────────────────────────────────────────────────
   11. 3D IMAGE TILT ON MOUSE MOVE
───────────────────────────────────────────────────────────── */
function initImageTilt() {
    const tiltTargets = $$('.about-image, .who-images');

    tiltTargets.forEach(container => {
        container.addEventListener('mousemove', e => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const rotY = clamp((x - cx) / cx * 12, -12, 12);
            const rotX = -clamp((y - cy) / cy * 8, -8, 8);

            $$('img', container).forEach(img => {
                img.style.transition = 'transform .1s ease, box-shadow .1s ease';
                img.style.transform = `perspective(900px) rotateY(${rotY}deg) rotateX(${rotX}deg) scale(1.03)`;
                img.style.boxShadow = `${-rotY}px ${rotX * 2}px 30px rgba(0,0,0,.25)`;
            });
        });

        container.addEventListener('mouseleave', () => {
            $$('img', container).forEach(img => {
                img.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1), box-shadow .6s ease';
                img.style.transform = '';
                img.style.boxShadow = '';
            });
        });
    });
}


/* ─────────────────────────────────────────────────────────────
   12. MAGNETIC BUTTONS
───────────────────────────────────────────────────────────── */
function initMagneticButtons() {
    $$('.btn-gold, .btn-primary').forEach(btn => {
        btn.addEventListener('mousemove', e => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px) scale(1.04)`;
            btn.style.boxShadow = `0 8px 30px rgba(201,168,76,.35)`;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
            btn.style.boxShadow = '';
        });
    });
}


/* ─────────────────────────────────────────────────────────────
   13. GALLERY STRIP  3D depth hover & auto scroll
───────────────────────────────────────────────────────────── */
function initGalleryStrip() {
    const track = $('.gallery-track');
    if (!track) return;

    // Duplicate items for seamless loop
    const items = $$('img', track);
    items.forEach(img => {
        const clone = img.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
    });

    // Auto-scroll
    let pos = 0;
    let paused = false;
    const speed = 0.6;

    track.addEventListener('mouseenter', () => paused = true);
    track.addEventListener('mouseleave', () => paused = false);

    (function scrollGallery() {
        if (!paused) {
            pos += speed;
            const halfWidth = track.scrollWidth / 2;
            if (pos >= halfWidth) pos = 0;
            track.style.transform = `translateX(-${pos}px)`;
        }
        requestAnimationFrame(scrollGallery);
    })();

    // Individual 3D hover
    $$('img', track).forEach(img => {
        img.addEventListener('mousemove', e => {
            const rect = img.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width - .5) * 20;
            const y = ((e.clientY - rect.top) / rect.height - .5) * 15;
            img.style.transform = `scale(1.1) perspective(600px) rotateY(${x}deg) rotateX(${-y}deg) translateY(-6px)`;
        });
        img.addEventListener('mouseleave', () => {
            img.style.transform = '';
        });
    });
}


/* ─────────────────────────────────────────────────────────────
   14. SECTION DIVIDERS  animated gold line between sections
───────────────────────────────────────────────────────────── */
function initSectionDividers() {
    const sections = $$('main > section');
    sections.forEach(sec => {
        const div = document.createElement('div');
        div.className = 'section-divider';
        sec.before(div);
    });

    const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                io.unobserve(e.target);
            }
        });
    }, { threshold: 0.5 });

    $$('.section-divider').forEach(d => io.observe(d));
}


/* ─────────────────────────────────────────────────────────────
   15. TESTIMONIAL  animated quote marks
───────────────────────────────────────────────────────────── */
function initTestimonial() {
    const card = $('.testimonial-card');
    if (!card) return;

    const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                card.style.transition = 'opacity 1s ease, transform 1s cubic-bezier(.16,1,.3,1)';
                card.style.opacity = '1';
                card.style.transform = 'scale(1) translateY(0)';
                io.unobserve(card);
            }
        });
    }, { threshold: 0.3 });

    card.style.opacity = '0';
    card.style.transform = 'scale(.95) translateY(30px)';
    io.observe(card);

    // Typewriter effect on testimonial text
    const text = $('.testimonial-text');
    if (!text) return;
    const original = text.textContent;

    const ioText = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                let i = 0;
                text.textContent = '';
                const interval = setInterval(() => {
                    text.textContent += original[i];
                    i++;
                    if (i >= original.length) clearInterval(interval);
                }, 20);
                ioText.unobserve(text);
            }
        });
    }, { threshold: 0.5 });
    ioText.observe(text);
}


/* ─────────────────────────────────────────────────────────────
   16. CONTACT FORM  staggered field entrance
───────────────────────────────────────────────────────────── */
function initContactForm() {
    const fields = $$('.contact-form .form-group, .contact-form button');
    fields.forEach(f => {
        f.style.opacity = '0';
        f.style.transform = 'translateX(30px)';
        f.style.transition = 'opacity .6s ease, transform .6s cubic-bezier(.16,1,.3,1)';
    });

    const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                fields.forEach((f, i) => {
                    setTimeout(() => {
                        f.style.opacity = '1';
                        f.style.transform = 'translateX(0)';
                    }, i * 100);
                });
                io.unobserve(e.target);
            }
        });
    }, { threshold: 0.1 });

    const form = $('.contact-form');
    if (form) io.observe(form);
}


/* ─────────────────────────────────────────────────────────────
   17. GOLD SUB-LABEL UNDERLINE DRAW
───────────────────────────────────────────────────────────── */
function initGoldLabels() {
    $$('.sub-label').forEach(el => el.classList.add('gold-line'));

    const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                io.unobserve(e.target);
            }
        });
    }, { threshold: 0.5 });

    $$('.sub-label').forEach(el => io.observe(el));
}


/* ─────────────────────────────────────────────────────────────
   18. SECTION BACKGROUND PARALLAX  subtle depth layers
───────────────────────────────────────────────────────────── */
function initSectionDepth() {
    // Add subtle background shift on sections as user scrolls
    const sections = $$('.who-we-are, .menu-section, .event-section');

    window.addEventListener('scroll', () => {
        sections.forEach(sec => {
            const rect = sec.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
                const shift = map(progress, 0, 1, -8, 8);
                sec.style.backgroundPositionY = `calc(50% + ${shift}px)`;
            }
        });
    }, { passive: true });
}


/* ─────────────────────────────────────────────────────────────
   19. MOBILE MENU  smooth slide with overlay
───────────────────────────────────────────────────────────── */
function initMobileMenu() {
    const btn = $('.mobile-menu-btn');
    const nav = $('.main-nav');
    if (!btn || !nav) return;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0,0,0,.5);
    z-index: 98;
    opacity: 0; pointer-events: none;
    transition: opacity .4s ease;
    backdrop-filter: blur(4px);
  `;
    document.body.appendChild(overlay);

    let open = false;
    btn.addEventListener('click', () => {
        open = !open;
        nav.style.cssText = open ?
            `display: flex; flex-direction: column; position: fixed; top: 0; right: 0; width: min(320px, 85vw); height: 100vh; background: #111; z-index: 99; padding: 80px 30px 30px; gap: 24px; box-shadow: -20px 0 60px rgba(0,0,0,.4); transform: translateX(0); transition: transform .4s cubic-bezier(.16,1,.3,1);` :
            `transform: translateX(100%); transition: transform .4s cubic-bezier(.16,1,.3,1);`;
        overlay.style.opacity = open ? '1' : '0';
        overlay.style.pointerEvents = open ? 'all' : 'none';
        btn.setAttribute('aria-expanded', open);
    });

    overlay.addEventListener('click', () => {
        open = false;
        nav.style.transform = 'translateX(100%)';
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
    });
}


/* ─────────────────────────────────────────────────────────────
   20. HEADER SCROLL BEHAVIOUR  shrink & gold border on scroll
───────────────────────────────────────────────────────────── */
function initHeaderScroll() {
    const header = $('.site-header');
    if (!header) return;

    let lastY = 0;
    window.addEventListener('scroll', () => {
        const y = window.scrollY;

        // Shrink
        if (y > 80) {
            header.style.boxShadow = '0 4px 30px rgba(0,0,0,.3)';
            header.style.borderBottom = '1px solid rgba(201,168,76,.25)';
        } else {
            header.style.boxShadow = '';
            header.style.borderBottom = '';
        }

        // Hide on scroll down, show on scroll up
        if (y > 200) {
            if (y > lastY) {
                header.style.transform = 'translateY(-100%)';
            } else {
                header.style.transform = 'translateY(0)';
            }
        }
        lastY = y;
    }, { passive: true });
}


/* ─────────────────────────────────────────────────────────────
   21. PRODUCT ITEMS  3D card reveal on scroll
───────────────────────────────────────────────────────────── */
function initProductCards() {
    $$('.product-item').forEach((item, i) => {
        item.style.transitionDelay = (i % 4) * 70 + 'ms';
    });
}


/* ─────────────────────────────────────────────────────────────
   22. FOOTER SOCIAL ICONS  bounce on hover
───────────────────────────────────────────────────────────── */
function initFooterSocial() {
    $$('.footer-social a, .top-bar-social a').forEach(a => {
        a.style.transition = 'transform .3s cubic-bezier(.34,1.56,.64,1), color .3s ease';
        a.addEventListener('mouseenter', () => {
            a.style.transform = 'translateY(-4px) scale(1.2) rotate(8deg)';
        });
        a.addEventListener('mouseleave', () => {
            a.style.transform = '';
        });
    });
}


/* ─────────────────────────────────────────────────────────────
   23. ENTRANCE ANIMATION FOR WHO-IMAGES  3D stagger
───────────────────────────────────────────────────────────── */
function initWhoImages() {
    $$('.who-images img').forEach((img, i) => {
        img.style.transitionDelay = i * 200 + 'ms';
    });
}


/* ─────────────────────────────────────────────────────────────
   24.  INIT  run everything on DOMContentLoaded
───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    initScrollProgress();
    initCustomCursor();
    initHeaderEntrance();
    initHeroAnimations();
    initTextSplit();
    initPills();
    initScrollReveal();
    initCheckList();
    initParallax();
    initImageTilt();
    initMagneticButtons();
    initGalleryStrip();
    initSectionDividers();
    initTestimonial();
    initContactForm();
    initGoldLabels();
    initSectionDepth();
    initMobileMenu();
    initHeaderScroll();
    initProductCards();
    initFooterSocial();
    initWhoImages();

    // Ensure gallery track doesn't overflow the section clip
    const track = $('.gallery-track');
    if (track) {
        track.parentElement.style.overflow = 'hidden';
        track.style.display = 'flex';
        track.style.flexWrap = 'nowrap';
        track.style.width = 'max-content';
    }

    console.log('✨ Luxe Canapés animations loaded  all systems go!');
});
// Mobile menu toggle
const menuBtn = document.querySelector('.mobile-menu-btn');
const mainNav = document.querySelector('.main-nav');

menuBtn.addEventListener('click', () => {
    menuBtn.classList.toggle('open');
    mainNav.classList.toggle('open');
});

// Close menu when a nav link is clicked
mainNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        menuBtn.classList.remove('open');
        mainNav.classList.remove('open');
    });
});