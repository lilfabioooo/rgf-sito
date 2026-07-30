/* ============================================================
   RGF — interazioni, animazioni, ricerca CER
   ============================================================ */
(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = typeof window.gsap !== "undefined";
  const isFine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ================= PRELOADER ================= */
  const preloader = document.getElementById("preloader");
  const preloaderBar = document.getElementById("preloaderBar");
  let barProgress = 0;
  const barTimer = setInterval(() => {
    barProgress = Math.min(barProgress + Math.random() * 22, 92);
    if (preloaderBar) preloaderBar.style.width = barProgress + "%";
  }, 160);

  let introDone = false;
  function closePreloader() {
    clearInterval(barTimer);
    if (preloaderBar) preloaderBar.style.width = "100%";
    setTimeout(() => {
      preloader?.classList.add("is-done");
      if (!introDone) { introDone = true; heroIntro(); }
    }, 350);
  }
  if (document.readyState === "complete") closePreloader();
  else window.addEventListener("load", closePreloader);
  // fail-safe: mai bloccare la pagina oltre 4s
  setTimeout(closePreloader, 4000);

  /* ================= SMOOTH SCROLL (Lenis) ================= */
  let lenis = null;
  if (!prefersReduced && typeof window.Lenis !== "undefined") {
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
    // hook di ispezione, solo in sviluppo locale
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) window.__lenis = lenis;
    function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);

    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (id.length === 1) return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -70 });
        // preventDefault sopprime il comportamento nativo dell'ancora:
        // hash e focus vanno ripristinati a mano, altrimenti lo skip-link
        // non sposta il punto di tabulazione e le ancore non sono condivisibili
        history.pushState(null, "", id);
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      });
    });
  }

  // chiudi il menu mobile al click su un link (con o senza Lenis)
  document.querySelectorAll(".nav__link, .nav__cta").forEach((a) => {
    a.addEventListener("click", () => impostaMenu(false));
  });

  /* ================= HERO INTRO ================= */
  function heroIntro() {
    if (prefersReduced) {
      document.querySelectorAll(".hero__line > span, .reveal-hero")
        .forEach((el) => { el.style.transform = "none"; el.style.opacity = "1"; });
      return;
    }
    if (hasGsap) {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      tl.to(".hero__line > span", { y: 0, duration: 1.15, stagger: 0.12 }, 0.1)
        .to(".reveal-hero", { opacity: 1, y: 0, duration: 0.9, stagger: 0.12 }, 0.5);
    } else {
      document.querySelectorAll(".hero__line > span").forEach((el, i) => {
        el.style.transition = `transform 1s ${0.1 + i * 0.12}s cubic-bezier(.22,1,.36,1)`;
        requestAnimationFrame(() => (el.style.transform = "translateY(0)"));
      });
      document.querySelectorAll(".reveal-hero").forEach((el, i) => {
        el.style.transition = `all .8s ${0.4 + i * 0.12}s cubic-bezier(.22,1,.36,1)`;
        requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "none"; });
      });
    }
  }

  /* ================= REVEAL ON SCROLL ================= */
  if (!prefersReduced && hasGsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    if (lenis) lenis.on("scroll", ScrollTrigger.update);

    document.querySelectorAll(".reveal").forEach((el) => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 86%" },
      });
    });

    // riempimento timeline processo
    const fill = document.getElementById("timelineFill");
    if (fill) {
      gsap.to(fill, {
        height: "100%", ease: "none",
        scrollTrigger: {
          trigger: "#timeline", start: "top 70%", end: "bottom 55%", scrub: 0.6,
          onUpdate(self) {
            document.querySelectorAll(".tstep").forEach((step, i, all) => {
              step.classList.toggle("is-lit", self.progress > i / all.length);
            });
          },
        },
      });
    }

    // sole di sfondo in parallasse
    gsap.to("#sun", {
      yPercent: -30, ease: "none",
      scrollTrigger: { trigger: "#sostenibilita", start: "top bottom", end: "bottom top", scrub: 1 },
    });
  } else {
    // fallback senza GSAP
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.style.transition = "all .9s cubic-bezier(.22,1,.36,1)";
          en.target.style.opacity = "1";
          en.target.style.transform = "none";
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    document.querySelectorAll(".tstep").forEach((el) => el.classList.add("is-lit"));
    const fill = document.getElementById("timelineFill");
    if (fill) fill.style.height = "100%";
  }

  /* ================= RETE DI SICUREZZA =================
     Se per qualsiasi motivo le animazioni non partono (CDN irraggiungibile,
     errore di una libreria), nessun contenuto deve restare invisibile. */
  setTimeout(() => {
    if (document.hidden) return; // scheda in background: rAF fermo, non è un guasto

    const mostra = (el) => {
      el.style.transition = "opacity .6s ease, transform .6s ease";
      el.style.opacity = "1";
      el.style.transform = "none";
    };
    const nascosti = [...document.querySelectorAll(".reveal, .reveal-hero")]
      .filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.05);
    const guasto = nascosti.some((el) => {
      const r = el.getBoundingClientRect();
      // 0.86 è lo start dei ScrollTrigger: sopra quella soglia l'elemento
      // è legittimamente ancora nascosto, non è un guasto
      return r.top < window.innerHeight * 0.86 && r.bottom > 0;
    });
    if (!guasto) return;

    // il motore di animazione non ha risposto: si mostra tutto, con un
    // semplice observer per gli elementi ancora sotto la piega
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { mostra(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.1 });
    nascosti.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.86 && r.bottom > 0) mostra(el);
      else io.observe(el);
    });
    document.querySelectorAll(".hero__line > span").forEach((el) => { el.style.transform = "none"; });
    document.querySelectorAll(".tstep").forEach((el) => el.classList.add("is-lit"));
  }, 5000);

  /* ================= CONTATORI ================= */
  const counters = document.querySelectorAll("[data-count]");
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      cio.unobserve(el);
      const end = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || "";
      const prefix = el.dataset.prefix || "";
      // Un anno non si conta da zero: durante l'animazione al posto del 1991
      // si leggeva "1123", che su un dato aziendale toglie credibilità.
      // Con data-from il conteggio parte da una base e resta plausibile.
      const start = el.dataset.from !== undefined ? parseFloat(el.dataset.from) : 0;
      // useGrouping "always": il default ICU per l'italiano è "min2", che sui
      // numeri a 4 cifre omette il separatore. Il contatore avrebbe chiuso su
      // "7000 m²" mentre il testo accanto scrive "7.000 m²".
      const fmt = (n) => {
        if (el.dataset.format !== "it") return String(n);
        try { return n.toLocaleString("it-IT", { useGrouping: "always" }); }
        catch { return n.toLocaleString("it-IT"); }
      };
      if (prefersReduced) { el.textContent = prefix + fmt(end) + suffix; return; }
      const dur = 1400;
      const t0 = performance.now();
      (function tick(now) {
        const p = Math.min((now - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        const val = Math.round(start + (end - start) * eased);
        el.textContent = prefix + fmt(val) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }, { threshold: 0.5 });
  counters.forEach((el) => cio.observe(el));

  /* ================= NAV ================= */
  const nav = document.getElementById("nav");
  const navLinksBox = document.getElementById("navLinks");
  const burger = document.getElementById("navBurger");
  const progress = document.getElementById("scrollProgress");
  let lastY = 0;

  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 40);
    // nascondi scendendo, mostra salendo — mai a menu aperto: il transform
    // creerebbe un containing block e sposterebbe l'overlay fuori schermo
    const menuAperto = navLinksBox?.classList.contains("is-open");
    if (!menuAperto && y > 500 && y > lastY + 6) nav.classList.add("is-hidden");
    else if (menuAperto || y < lastY - 6 || y < 200) nav.classList.remove("is-hidden");
    lastY = y;

    const h = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Sotto questa soglia il menu è un overlay: da chiuso deve sparire davvero
  // da tastiera e da screen reader, senza dipendere dalla fine della transizione.
  const layoutMobile = window.matchMedia("(max-width: 1100px)");
  function aggiornaInert() {
    if (!navLinksBox) return;
    navLinksBox.inert = layoutMobile.matches && !navLinksBox.classList.contains("is-open");
  }
  layoutMobile.addEventListener("change", aggiornaInert);

  function impostaMenu(aperto) {
    if (!navLinksBox || !burger) return;
    navLinksBox.classList.toggle("is-open", aperto);
    aggiornaInert();
    burger.classList.toggle("is-open", aperto);
    burger.setAttribute("aria-expanded", String(aperto));
    burger.setAttribute("aria-label", aperto ? "Chiudi menu" : "Apri menu");
    document.body.classList.toggle("no-scroll", aperto);
    if (aperto) {
      nav.classList.remove("is-hidden");
      lenis?.stop();
      // il focus va spostato a transizione avviata: un elemento ancora
      // in visibility: hidden non è focalizzabile
      setTimeout(() => navLinksBox.querySelector("a")?.focus(), 120);
    } else {
      lenis?.start();
    }
  }

  aggiornaInert();

  burger?.addEventListener("click", () => {
    impostaMenu(!navLinksBox.classList.contains("is-open"));
  });

  // ESC chiude il menu mobile e riporta il focus sul pulsante
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navLinksBox?.classList.contains("is-open")) {
      impostaMenu(false);
      burger?.focus();
    }
  });

  // link attivo per sezione
  const sections = ["gruppo", "servizi", "processo", "sostenibilita", "cer", "contatti"]
    .map((id) => document.getElementById(id)).filter(Boolean);
  const sio = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        document.querySelectorAll(".nav__link").forEach((l) =>
          l.classList.toggle("is-active", l.getAttribute("href") === "#" + en.target.id));
      }
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  sections.forEach((s) => sio.observe(s));

  /* ================= CURSORE + MAGNETICI ================= */
  if (isFine && !prefersReduced) {
    const cursor = document.getElementById("cursor");
    const dot = document.getElementById("cursorDot");
    const pos = { x: -100, y: -100 };
    const cur = { x: -100, y: -100 };
    let cursorRaf = 0;

    window.addEventListener("pointermove", (e) => {
      pos.x = e.clientX; pos.y = e.clientY;
      if (!cursorRaf) cursorRaf = requestAnimationFrame(cursorLoop);
    }, { passive: true });

    // il loop si ferma da solo quando il cursore ha raggiunto la posizione:
    // niente rAF perenne a puntatore fermo o a scheda in background
    function cursorLoop() {
      const dx = pos.x - cur.x, dy = pos.y - cur.y;
      cur.x += dx * 0.16;
      cur.y += dy * 0.16;
      if (cursor) cursor.style.transform = `translate(${cur.x}px, ${cur.y}px) translate(-50%,-50%)`;
      if (dot) dot.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%,-50%)`;
      cursorRaf = Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4
        ? requestAnimationFrame(cursorLoop)
        : 0;
    }
    document.querySelectorAll("a, button, .card, input, textarea, select, .chip").forEach((el) => {
      el.addEventListener("pointerenter", () => cursor?.classList.add("is-hover"));
      el.addEventListener("pointerleave", () => cursor?.classList.remove("is-hover"));
    });

    // pulsanti magnetici
    document.querySelectorAll("[data-magnetic]").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        btn.style.transform = `translate(${dx * 0.18}px, ${dy * 0.22}px)`;
      });
      btn.addEventListener("pointerleave", () => {
        btn.style.transition = "transform .5s cubic-bezier(.22,1,.36,1)";
        btn.style.transform = "";
        setTimeout(() => (btn.style.transition = ""), 500);
      });
    });

    // tilt 3D + glow segui-mouse sulle card
    document.querySelectorAll("[data-tilt]").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty("--mx", px * 100 + "%");
        card.style.setProperty("--my", py * 100 + "%");
        const rx = (0.5 - py) * 7;
        const ry = (px - 0.5) * 7;
        card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
      });
      card.addEventListener("pointerleave", () => {
        card.style.transition = "transform .6s cubic-bezier(.22,1,.36,1)";
        card.style.transform = "";
        setTimeout(() => (card.style.transition = ""), 600);
      });
    });
  }

  /* ================= MARQUEE (duplica per loop) ================= */
  document.querySelectorAll("[data-marquee] .marquee__track").forEach((track) => {
    track.innerHTML += track.innerHTML;
  });

  /* ================= RICERCA CER ================= */
  const cerInput = document.getElementById("cerInput");
  const cerResults = document.getElementById("cerResults");
  const cerClear = document.getElementById("cerClear");
  const cerCount = document.getElementById("cerCount");
  const chips = document.querySelectorAll(".chip");
  let cerFilter = "all";

  // minuscole senza accenti/diacritici, così "però" trova "pero"
  function normalizza(s) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  // In italiano genere e numero cambiano la vocale finale: cercando "motore"
  // si deve trovare anche "motori", quindi si confronta la radice.
  function radice(parola) {
    return parola.length >= 5 && /[aeiou]$/.test(parola)
      ? parola.slice(0, -1)
      : parola;
  }

  // una voce corrisponde se il codice inizia con le cifre cercate
  // oppure se la descrizione contiene tutte le parole digitate
  function corrisponde(r, parole, qCode) {
    if (qCode && r.c.replace(/\s/g, "").startsWith(qCode)) return true;
    const desc = normalizza(r.d);
    return parole.every((parola) => desc.includes(radice(parola)));
  }

  function renderCer() {
    if (!cerResults || !window.CER_DATA) return;
    const q = normalizza((cerInput?.value || "").trim());
    const qCode = q.replace(/[\s.]/g, "");
    cerClear?.classList.toggle("is-visible", q.length > 0);

    const parole = q ? q.split(/\s+/).filter(Boolean) : [];
    const soloCifre = /^\d+$/.test(qCode) ? qCode : "";

    const rows = window.CER_DATA.filter((r) => {
      if (cerFilter === "p" && (r.ch || !r.p)) return false;
      if (cerFilter === "np" && (r.ch || r.p)) return false;
      if (!q) return true;
      return corrisponde(r, parole, soloCifre);
    });

    const codici = rows.filter((r) => !r.ch).length;
    if (cerCount) {
      cerCount.textContent = codici === 0
        ? "Nessun codice trovato"
        : codici === 1 ? "1 codice trovato" : `${codici} codici trovati`;
    }

    const LIMITE = 60;
    const shown = rows.slice(0, LIMITE);
    if (!shown.length) {
      cerResults.innerHTML = `<div class="cer__empty">
        Nessun risultato per la ricerca.<br>
        <small>Provate con un termine diverso oppure <a href="#contatti" style="color:var(--acc)">chiedete ai nostri tecnici</a>.</small>
      </div>`;
      return;
    }

    cerResults.innerHTML = shown.map((r, i) => {
      const star = r.p ? "*" : "";
      const cls = r.ch ? "cer-row cer-row--chapter" : "cer-row";
      const codeCls = r.p ? "cer-row__code is-p" : "cer-row__code";
      const tag = r.p ? '<span class="cer-row__tag">PERICOLOSO</span>' : "";
      return `<div class="${cls}" style="animation-delay:${Math.min(i * 28, 400)}ms">
        <span class="${codeCls}">${r.c}${star}</span>
        <span class="cer-row__desc">${r.d}</span>${tag}
      </div>`;
    }).join("") + (codici > shown.filter((r) => !r.ch).length
      ? `<div class="cer__empty"><small>… e altri ${codici - shown.filter((r) => !r.ch).length} codici: affinate la ricerca.</small></div>`
      : "");
  }

  // debounce: evita di ricostruire la lista (e di annunciarla) a ogni tasto
  let cerTimer;
  cerInput?.addEventListener("input", () => {
    clearTimeout(cerTimer);
    cerTimer = setTimeout(renderCer, 220);
  });
  cerClear?.addEventListener("click", () => { cerInput.value = ""; renderCer(); cerInput.focus(); });
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => {
        c.classList.remove("is-active");
        c.setAttribute("aria-pressed", "false");
      });
      chip.classList.add("is-active");
      chip.setAttribute("aria-pressed", "true");
      cerFilter = chip.dataset.filter;
      renderCer();
    });
  });
  renderCer();

  /* ================= FORM ================= */
  const form = document.getElementById("contactForm");
  const status = document.getElementById("formStatus");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = document.getElementById("fNome").value.trim();
    const email = document.getElementById("fEmail").value.trim();
    const msg = document.getElementById("fMsg").value.trim();
    const privacy = document.getElementById("fPrivacy").checked;

    const errore = (messaggio, campo) => {
      status.textContent = messaggio;
      status.className = "form__status err";
      campo?.focus();
    };

    if (!nome || !email || !msg || !privacy) {
      const primoVuoto = !nome ? document.getElementById("fNome")
        : !email ? document.getElementById("fEmail")
        : !msg ? document.getElementById("fMsg")
        : document.getElementById("fPrivacy");
      errore("Compilate i campi obbligatori (*) e accettate l'informativa privacy.", primoVuoto);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errore("Inserite un indirizzo email valido.", document.getElementById("fEmail"));
      return;
    }

    // Nessun backend: si apre il client di posta precompilato. Non potendo
    // sapere se l'apertura riesce, si mostra sempre anche il ripiego manuale.
    const azienda = document.getElementById("fAzienda").value.trim();
    const tel = document.getElementById("fTel").value.trim();
    const servizio = document.getElementById("fServizio").value;
    const testo =
      `Nome: ${nome}\nAzienda: ${azienda || "-"}\nEmail: ${email}\nTelefono: ${tel || "-"}\n` +
      `Servizio: ${servizio || "-"}\n\nMessaggio:\n${msg}`;
    const oggetto = `Richiesta preventivo — ${nome}${azienda ? " (" + azienda + ")" : ""}`;
    let url = `mailto:info@rgfambiente.it?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(testo)}`;

    // oltre ~2000 caratteri molti client troncano o non aprono affatto
    if (url.length > 1900) {
      url = `mailto:info@rgfambiente.it?subject=${encodeURIComponent(oggetto)}`;
    }
    window.location.href = url;

    status.className = "form__status ok";
    status.innerHTML =
      "Si sta aprendo il vostro programma di posta con la richiesta già compilata. " +
      "<strong>Se non si apre</strong>, scriveteci direttamente a " +
      '<a href="mailto:info@rgfambiente.it">info@rgfambiente.it</a> ' +
      'o chiamate lo <a href="tel:+39036352037">0363 52037</a>. ' +
      '<button type="button" class="form__copy" id="formCopy">Copia il testo della richiesta</button>';

    document.getElementById("formCopy")?.addEventListener("click", async (ev) => {
      try {
        await navigator.clipboard.writeText(testo);
        ev.target.textContent = "Testo copiato ✓";
      } catch {
        ev.target.textContent = "Copia non riuscita: selezionate il testo a mano";
      }
    });
  });

  /* ================= VARIE ================= */
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
