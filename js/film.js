/* Film Higgsfield: l'apertura parte subito, le bande solo quando entrano in
   vista e si fermano quando escono. Con «riduci movimento» o col risparmio
   dati resta il fotogramma fermo (poster). Sul telefono la versione a 720 px. */
(function () {
  "use strict";
  var fermo = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var conn = navigator.connection;
  var risparmio = conn && (conn.saveData || /2g/.test(conn.effectiveType || ""));
  if (fermo || risparmio) return;
  var piccolo = matchMedia("(max-width: 720px)").matches;

  function carica(v) {
    if (v.dataset.caricato) return;
    v.dataset.caricato = "1";
    v.src = piccolo ? v.dataset.srcPiccolo : v.dataset.src;
    v.load();
  }
  function gira(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }

  var apertura = document.getElementById("heroFilm");
  if (apertura) { carica(apertura); gira(apertura); }

  var bande = document.querySelectorAll("video.film");
  if (!("IntersectionObserver" in window)) {
    bande.forEach(function (v) { carica(v); gira(v); });
    return;
  }
  var vista = new IntersectionObserver(function (righe) {
    righe.forEach(function (r) {
      if (r.isIntersecting) { carica(r.target); gira(r.target); }
      else if (!r.target.paused) r.target.pause();
    });
  }, { rootMargin: "250px 0px" });
  bande.forEach(function (v) { vista.observe(v); });
  // l'apertura si ferma quando la si supera, e riparte tornando su
  if (apertura) new IntersectionObserver(function (r) {
    r[0].isIntersecting ? gira(apertura) : apertura.pause();
  }).observe(apertura);
})();
