/* ============================================================
   RGF — Hero 3D scene (Three.js)
   Autoarticolato Mercedes-Benz Actros con cisterna cromata,
   parcheggiato al tramonto
   — ispirato alle foto reali del parco mezzi RGF —

   Convenzioni: X = lunghezza (muso a +X), Y = altezza (0 = suolo),
   Z = larghezza. Ruota di riferimento: raggio 0.54, asse su Y 0.54.
   ============================================================ */
import * as THREE from "three";

const canvas = document.getElementById("heroCanvas");
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (canvas && !prefersReduced) {
  initScene();
} else if (canvas) {
  canvas.style.background =
    "radial-gradient(ellipse at 60% 60%, rgba(255,140,60,.12), transparent 60%)";
}

function initScene() {
  const scene = new THREE.Scene();
  // Golden hour: la nebbia è la foschia calda del controluce — la distanza
  // non si spegne nel nero, vira all'ambra scura. Colore tenuto BASSO di
  // luminanza (bruno caldo scuro) e densità contenuta: a 0.030 e tinta chiara
  // impastava capannoni e filari in un beige uniforme da tempesta di sabbia e
  // uccideva il contrasto. Così invece i volumi lontani restano sagome scure
  // appena velate d'oro, che è il look cinematografico voluto.
  scene.fog = new THREE.FogExp2(0x3f2e1e, 0.019);

  const camera = new THREE.PerspectiveCamera(
    42, window.innerWidth / window.innerHeight, 0.1, 120
  );

  // su schermi piccoli si alleggerisce tutto: meno pixel, ombre più leggere
  const isSmall = window.innerWidth < 900;

  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: !isSmall, powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2));
  // il dimensionamento lo fa setCamera() misurando il canvas: un setSize qui
  // scriverebbe stili inline che poi sovrascriverebbero il CSS
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Esposizione più alta (1.48): il golden hour è luce abbondante e radente,
  // non un crepuscolo che si spegne. ACES comprime da solo le alte luci, così
  // il sole e i cromi vanno in saturazione morbida — è il rolloff filmico che
  // fa leggere l'immagine come pellicola invece che come render piatto.
  renderer.toneMappingExposure = 1.4;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  /* ---------- luci: golden hour, sole basso in controluce ----------
     Lo schema è la regola del ritratto in controluce all'ora d'oro: chiave
     calda e radente da dietro, cielo freddo come riempimento tenuto in
     netta minoranza. È lo scarto di temperatura fra i due — oro contro
     ciano — a scolpire i volumi e a dare il grado cromatico da cinema. */
  // Cielo/terra: la cupola all'ora d'oro è ambra calda in alto, e il rimbalzo
  // da terra è un bronzo caldo (asfalto e piazzale scaldati dal sole radente),
  // non più il verde-antracite di prima.
  const hemi = new THREE.HemisphereLight(0xffcf9a, 0x3a2a1c, 1.35);
  scene.add(hemi);

  // Sole più basso (Y 3.4 contro 5.5) e più caldo/saturo: a ~22° sull'orizzonte
  // l'ombra del mezzo si sdraia lunga in avanti, com'è tipico dell'ora d'oro.
  const sunLight = new THREE.DirectionalLight(0xffb562, 3.0);
  sunLight.position.set(-9, 3.4, -5);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
  // Cono allargato ancora in verticale (top 11): col sole più basso l'ombra
  // proiettata è più lunga e alta, e usciva dal frustum della shadow camera
  // spezzandosi su una riga netta a metà asfalto.
  sunLight.shadow.camera.left = -14;
  sunLight.shadow.camera.right = 14;
  sunLight.shadow.camera.top = 11;
  sunLight.shadow.camera.bottom = -6;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 46;
  sunLight.shadow.bias = -0.0006;
  scene.add(sunLight);

  // Riempimento dal lato camera = il cielo freddo che apre le ombre. Va tenuto
  // in minoranza rispetto alla chiave (1.7 contro 3.0) e non troppo azzurro,
  // altrimenti il davanti del mezzo vira al grigio e uccide la dominante d'oro.
  // È comunque necessario: il sole è dietro, senza questo il muso resta nero.
  const fill = new THREE.DirectionalLight(0x9fb8d0, 1.7);
  fill.position.set(6, 4, 8);
  scene.add(fill);

  // Luce di stacco: da fredda a calda dorata. All'ora d'oro il bordo
  // controluce è il taglio più luminoso e caldo dell'immagine — è la riga
  // d'oro che corre lungo il profilo della cabina e sul colmo della cisterna.
  const rim = new THREE.DirectionalLight(0xffd08a, 2.1);
  rim.position.set(-4, 5, -7);
  scene.add(rim);

  // bacio di luce calda sul frontale cromato, più intenso: è il punto in cui
  // il sole radente accende la stella e le lamelle della calandra
  const kiss = new THREE.PointLight(0xffcf92, 34, 0, 2);
  kiss.position.set(5.5, 2.5, 4.5);
  scene.add(kiss);

  /* ---------- ambiente ----------
     La mappa d'ambiente è ciò che i metalli riflettono: senza, cromo e inox
     scivolano verso la plastica nera. La versione cotta in Blender
     (assets/env-dusk.jpg) è un cielo *freddo* da ora blu, e sul golden hour
     rifletteva azzurro sui cromi litigando con la dominante d'oro. Qui la
     rimpiazza un ambiente dorato disegnato su canvas ad alta risoluzione:
     cupola ambra, fascia d'orizzonte incandescente, disco del sole e qualche
     punto luce caldo lontano — sono quei punti a dare all'inox la scintilla
     speculare che lo fa leggere come metallo vero. */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = makeGoldenEnvironment(pmrem).texture;
  pmrem.dispose();

  /* ---------- materiali ---------- */
  // cabina: lamiera verniciata argento (bassa metalness), non cromo —
  // altrimenti rispecchia il tramonto e vira al bronzo. Il clearcoat dà la
  // doppia riflessione tipica della vernice; su mobile si scende a standard.
  const paint = (color) =>
    isSmall
      ? new THREE.MeshStandardMaterial({ color, metalness: 0.26, roughness: 0.34, envMapIntensity: 0.85 })
      : new THREE.MeshPhysicalMaterial({
          color, metalness: 0.2, roughness: 0.32,
          clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.9,
        });

  const M = {
    chrome: new THREE.MeshStandardMaterial({ color: 0xe9ebee, metalness: 1.0, roughness: 0.07, envMapIntensity: 1.6 }),
    steel:  new THREE.MeshStandardMaterial({ color: 0xc9ced4, metalness: 0.82, roughness: 0.28, envMapIntensity: 1.05 }),
    cab:    paint(0xe2e7ea),
    dark:   new THREE.MeshStandardMaterial({ color: 0x1a1e22, metalness: 0.5, roughness: 0.55 }),
    grate:  new THREE.MeshStandardMaterial({ color: 0x272c31, metalness: 0.7, roughness: 0.72 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0a0c0e, metalness: 0.0, roughness: 1.0 }),
    glass:  new THREE.MeshStandardMaterial({ color: 0x0e151c, metalness: 0.9, roughness: 0.05, envMapIntensity: 1.5 }),
    tire:   new THREE.MeshStandardMaterial({ color: 0x0c0e10, metalness: 0.08, roughness: 0.95 }),
    hub:    new THREE.MeshStandardMaterial({ color: 0xb6bcc2, metalness: 0.95, roughness: 0.22, envMapIntensity: 1.3 }),
    // verde di livrea, non insegna al neon: senza emissive e meno saturo
    // Azzurro RGF (#2d8fcc), rilevato dal sito dell'azienda: la fascia sulla
    // cisterna porta il colore del marchio, non un verde di fantasia.
    green:  new THREE.MeshStandardMaterial({ color: 0x2d8fcc, metalness: 0.25, roughness: 0.42 }),
    // Mantello cisterna: alluminio lucidato.
    // Con la vecchia environment map disegnata su canvas la fiancata a
    // metalness alta riflettava solo cielo sotto l'orizzonte e scendeva a
    // nero (misurato rgb 14,16,16 sull'equatore), e serviva scendere a 0.72
    // di metalness per farla reagire alle luci. Ora che l'ambiente cotto ha
    // orizzonte ambrato e lampioni si puo' tornare a metallo vero.
    // 0.65 e non 0.90: le autocisterne stradali sono inox satinato, non
    // specchio. A metalness alta il mantello e' quasi solo riflesso, e visto
    // che il picco dell'ambiente sta a -169 gradi mentre la camera guarda da
    // +90 la fiancata restava nera. Con una quota di diffuso il riempimento
    // lato camera la fa tornare argento, e la striscia speculare d'orizzonte
    // sopra l'equatore resta.
    tankSkin: new THREE.MeshStandardMaterial({ color: 0xc9cfd5, metalness: 0.65, roughness: 0.30, envMapIntensity: 1.2 }),
    lightOn:new THREE.MeshStandardMaterial({ color: 0xf6e6c8, emissive: 0xffc06a, emissiveIntensity: 1.1 }),
    lightDim:new THREE.MeshStandardMaterial({ color: 0xe6dcc8, emissive: 0xffb968, emissiveIntensity: 0.65 }),
    amber:  new THREE.MeshStandardMaterial({ color: 0xffcf8f, emissive: 0xff9a30, emissiveIntensity: 1.5 }),
    tail:   new THREE.MeshStandardMaterial({ color: 0x4a0c10, metalness: 0.3, roughness: 0.45, emissive: 0xff2418, emissiveIntensity: 1.0 }),
    plate:  new THREE.MeshStandardMaterial({ color: 0xd8dde1, metalness: 0.1, roughness: 0.6 }),
    adr:    new THREE.MeshStandardMaterial({ color: 0xef8a1c, metalness: 0.1, roughness: 0.5 }),
  };
  // i parafanghi sono gusci aperti: vanno visti anche da dentro
  M.fender = M.cab.clone();
  M.fender.side = THREE.DoubleSide;

  // livello di dettaglio: su mobile si saltano viti, corrimano, gradini…
  const D = !isSmall;
  const bevelSeg = isSmall ? 2 : 3;

  const truck = new THREE.Group();
  scene.add(truck);

  const add = (geo, mat, x, y, z, opts = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (opts.rx) m.rotation.x = opts.rx;
    if (opts.ry) m.rotation.y = opts.ry;
    if (opts.rz) m.rotation.z = opts.rz;
    if (opts.sx) m.scale.x = opts.sx;
    m.castShadow = true;
    m.receiveShadow = true;
    truck.add(m);
    return m;
  };

  // stesso pezzo sulle due fiancate
  const addPair = (geo, mat, x, y, z, opts = {}) => {
    add(geo, mat, x, y, z, opts);
    add(geo, mat, x, y, -z, opts);
  };

  // scatola con spigoli raccordati: il bevel è ciò che fa "leggere" la
  // lamiera sotto la luce di stacco, al posto dei cubi a spigolo vivo
  const rbox = (w, h, d, r = 0.08) => roundedBox(w, h, d, r, bevelSeg);

  // guscio cilindrico aperto usato come parafango (semicerchio sopra la ruota)
  const arch = (radius, width, span = 0.9) =>
    new THREE.CylinderGeometry(
      radius, radius, width, 22, 1, true,
      Math.PI * (1 - span / 2), Math.PI * span
    );

  /* ============================================================
     MOTRICE — Mercedes-Benz Actros, cabina alta
     cabina: X 2.45→4.87, Y 1.05→3.67, Z ±1.23
     assi: sterzante X 3.72, motore X 1.32 (ruote gemellate)
     ============================================================ */

  /* --- scocca cabina --- */
  add(rbox(2.42, 2.62, 2.46, 0.14), M.cab, 3.66, 2.36, 0);
  // deflettore di tetto: basso e teso, sale verso la cisterna
  add(rbox(1.94, 0.24, 2.32, 0.07), M.cab, 3.56, 3.74, 0, { rz: -0.055 });
  // alette laterali che convogliano l'aria sul semirimorchio
  addPair(rbox(0.62, 1.30, 0.10, 0.05), M.cab, 2.62, 2.95, 1.14, { ry: 0.10 });

  /* --- parabrezza e vetri --- */
  // cornice scura leggermente inclinata, poi il vetro appena sporgente.
  // La larghezza sta 0.20 sotto quella della cabina per lato: quel filo di
  // lamiera è il montante, senza il quale parabrezza e finestrini si
  // saldano in un'unica fascia nera.
  add(rbox(0.07, 1.22, 2.06, 0.06), M.dark, 4.90, 2.98, 0, { rz: 0.06 });
  add(rbox(0.05, 1.06, 1.92, 0.05), M.glass, 4.945, 2.98, 0, { rz: 0.06 });
  // visiera parasole sopra il parabrezza
  add(rbox(0.42, 0.13, 2.48, 0.05), M.cab, 4.80, 3.63, 0, { rz: 0.06 });
  // luci di ingombro sulla visiera
  if (D) [-0.86, -0.43, 0, 0.43, 0.86].forEach((z) =>
    add(rbox(0.09, 0.07, 0.15, 0.03), M.amber, 4.78, 3.72, z)
  );
  // finestrini porta + oblò basso lato marciapiede
  addPair(rbox(1.02, 0.60, 0.05, 0.05), M.glass, 4.08, 2.98, 1.235);
  addPair(rbox(0.32, 0.28, 0.05, 0.04), M.glass, 4.58, 2.18, 1.235);
  if (D) {
    // profili porta e maniglia
    addPair(rbox(0.03, 1.85, 0.035, 0.015), M.dark, 3.44, 2.20, 1.238);
    addPair(rbox(0.03, 1.85, 0.035, 0.015), M.dark, 4.68, 2.20, 1.238);
    addPair(rbox(1.24, 0.03, 0.035, 0.015), M.dark, 4.06, 1.30, 1.238);
    addPair(rbox(0.20, 0.06, 0.05, 0.02), M.chrome, 3.62, 2.55, 1.245);
  }
  // filetto verde RGF sul sottoporta
  addPair(rbox(1.90, 0.09, 0.03, 0.015), M.green, 3.70, 1.36, 1.245);

  /* --- calandra con stella a tre punte --- */
  add(rbox(0.10, 1.18, 2.12, 0.06), M.dark, 4.90, 1.92, 0);
  // lamelle cromate: intere in basso, spezzate attorno alla stella
  [1.44, 1.66, 1.88].forEach((y) =>
    add(rbox(0.09, 0.055, 1.98, 0.025), M.steel, 4.94, y, 0)
  );
  addPair(rbox(0.09, 0.055, 0.74, 0.025), M.steel, 4.94, 2.22, 0.80);
  add(rbox(0.09, 0.055, 1.98, 0.025), M.steel, 4.94, 2.44, 0);
  // stella: anello + tre raggi a 120°
  const starC = { x: 4.985, y: 2.22 };
  add(new THREE.TorusGeometry(0.285, 0.028, 10, 40), M.chrome, starC.x, starC.y, 0, { ry: Math.PI / 2 });
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3;
    add(
      rbox(0.05, 0.28, 0.05, 0.02), M.chrome,
      starC.x, starC.y + Math.cos(a) * 0.14, Math.sin(a) * 0.14, { rx: a }
    );
  }
  add(new THREE.SphereGeometry(0.055, 16, 12), M.chrome, starC.x + 0.01, starC.y, 0);

  /* --- paraurti, fari, targa --- */
  add(rbox(0.44, 0.66, 2.56, 0.10), M.cab, 4.80, 0.95, 0);
  add(rbox(0.34, 0.30, 2.44, 0.07), M.dark, 4.84, 0.48, 0);   // spoiler inferiore
  addPair(rbox(0.14, 0.34, 0.54, 0.05), M.dark, 4.94, 1.00, 0.92);
  addPair(rbox(0.07, 0.22, 0.42, 0.04), M.lightOn, 4.99, 1.00, 0.92);
  addPair(rbox(0.09, 0.13, 0.19, 0.03), M.lightDim, 4.98, 0.72, 0.62);  // fendinebbia
  addPair(rbox(0.08, 0.30, 0.30, 0.05), M.dark, 4.99, 0.82, 1.10);      // prese d'aria
  add(rbox(0.05, 0.20, 0.46, 0.02), M.plate, 5.03, 0.78, 0);            // targa

  /* --- specchi --- */
  addPair(rbox(0.05, 0.05, 0.36, 0.02), M.dark, 4.62, 3.42, 1.40);
  addPair(rbox(0.05, 0.32, 0.05, 0.02), M.dark, 4.62, 3.26, 1.57);
  addPair(rbox(0.09, 0.66, 0.19, 0.04), M.dark, 4.60, 2.98, 1.58);
  addPair(rbox(0.03, 0.56, 0.13, 0.03), M.glass, 4.545, 2.98, 1.58);
  addPair(rbox(0.08, 0.26, 0.17, 0.04), M.dark, 4.60, 2.56, 1.56);

  /* --- gradini di accesso --- */
  addPair(rbox(0.52, 0.72, 0.14, 0.05), M.dark, 4.28, 0.72, 1.20);
  if (D) [0.42, 0.70, 0.98].forEach((y) =>
    addPair(rbox(0.46, 0.05, 0.20, 0.02), M.steel, 4.28, y, 1.24)
  );

  /* --- telaio e organi sotto cabina --- */
  addPair(rbox(4.88, 0.28, 0.16, 0.04), M.dark, 2.44, 1.02, 0.42);      // longheroni
  [4.60, 3.10, 1.95, 0.25].forEach((x) =>
    add(rbox(0.12, 0.22, 0.86, 0.04), M.dark, x, 1.02, 0)               // traverse
  );
  // serbatoio gasolio cromato (sx) e AdBlue (dx), incassati sotto il longherone
  add(new THREE.CylinderGeometry(0.34, 0.34, 1.05, 26), M.chrome, 2.56, 0.74, 1.02, { rz: Math.PI / 2 });
  add(new THREE.CylinderGeometry(0.28, 0.28, 0.90, 22), M.steel, 2.56, 0.72, -1.02, { rz: Math.PI / 2 });
  if (D) [2.20, 2.92].forEach((x) =>
    add(new THREE.TorusGeometry(0.35, 0.028, 8, 20), M.steel, x, 0.74, 1.02, { ry: Math.PI / 2 })
  );
  // serbatoi aria + scarico
  addPair(new THREE.CylinderGeometry(0.18, 0.18, 0.66, 18), M.steel, 0.30, 0.80, 0.70, { rz: Math.PI / 2 });
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.46, 12), M.chrome, 0.12, 0.62, -0.95, { rz: Math.PI / 2 });
  // pedana e armadio dietro la cabina
  add(rbox(0.90, 0.07, 2.00, 0.03), M.grate, 2.05, 1.18, 0);
  add(rbox(0.34, 1.30, 1.60, 0.06), M.dark, 2.28, 1.90, 0);
  // ralla
  add(new THREE.CylinderGeometry(0.62, 0.62, 0.09, 24), M.dark, 0.95, 1.26, 0);
  addPair(rbox(0.90, 0.16, 0.20, 0.04), M.dark, 0.95, 1.14, 0.45);
  // parafanghi e paraspruzzi
  addPair(arch(0.66, 0.44, 0.78), M.fender, 3.72, 0.54, 1.05, { rx: Math.PI / 2 });
  addPair(arch(0.70, 0.62, 0.84), M.fender, 1.32, 0.54, 0.95, { rx: Math.PI / 2 });
  addPair(rbox(0.03, 0.46, 0.56, 0.015), M.rubber, 0.70, 0.32, 0.95);

  /* ============================================================
     SEMIRIMORCHIO CISTERNA
     mantello: X -4.57→1.33, asse a Y 2.48, raggio 1.05
     assi: -2.55 / -3.45 / -4.35, tutti gemellati
     ============================================================ */
  const tankY = 2.48;
  add(new THREE.CylinderGeometry(1.05, 1.05, 5.90, 56), M.tankSkin, -1.62, tankY, 0, { rz: Math.PI / 2 });
  // calotte ellittiche
  const capGeo = new THREE.SphereGeometry(1.05, 40, 28);
  add(capGeo, M.tankSkin, 1.33, tankY, 0, { sx: 0.42 });
  add(capGeo, M.tankSkin, -4.57, tankY, 0, { sx: 0.42 });
  // anelli di rinforzo, fuori dalla fascia della scritta (X -2.95…-0.05)
  const ringGeo = new THREE.TorusGeometry(1.062, 0.030, 12, 64);
  [-4.30, -3.60, 0.25, 0.70].forEach((x) =>
    add(ringGeo, M.steel, x, tankY, 0, { ry: Math.PI / 2 })
  );
  // fascia verde RGF a ridosso della calotta anteriore
  add(new THREE.CylinderGeometry(1.072, 1.072, 0.18, 56), M.green, 1.05, tankY, 0, { rz: Math.PI / 2 });

  // passerella, passi d'uomo, corrimano sul lato cieco
  add(rbox(4.70, 0.06, 0.54, 0.02), M.grate, -2.05, 3.56, 0);
  [-3.80, -1.75, 0.20].forEach((x) => {
    add(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 24), M.steel, x, 3.60, 0);
    add(new THREE.TorusGeometry(0.33, 0.035, 8, 24), M.chrome, x, 3.66, 0, { rx: Math.PI / 2 });
  });
  if (D) {
    [-4.30, -3.20, -2.10, -1.00, 0.10].forEach((x) =>
      add(rbox(0.05, 0.34, 0.05, 0.02), M.steel, x, 3.72, -0.34)
    );
    add(rbox(4.55, 0.05, 0.05, 0.02), M.steel, -2.10, 3.87, -0.34);
  }

  // telaio, ralla lato rimorchio, piedi di appoggio
  add(rbox(1.60, 0.10, 1.90, 0.04), M.dark, 0.75, 1.36, 0);
  addPair(rbox(5.20, 0.24, 0.14, 0.04), M.dark, -2.30, 1.24, 0.42);
  addPair(rbox(0.17, 0.80, 0.17, 0.04), M.steel, -0.45, 0.72, 0.80);
  addPair(rbox(0.34, 0.10, 0.34, 0.03), M.dark, -0.45, 0.28, 0.80);
  add(rbox(1.70, 0.08, 0.08, 0.03), M.steel, -0.45, 1.00, 0);
  // barre paraincastro laterali
  addPair(rbox(2.30, 0.09, 0.07, 0.03), M.steel, -1.05, 0.74, 1.16);
  if (D) [-0.30, -1.90].forEach((x) =>
    addPair(rbox(0.07, 0.50, 0.07, 0.025), M.steel, x, 0.98, 1.16)
  );
  // parafango unico sul carrello a 3 assi
  addPair(rbox(2.42, 0.10, 0.62, 0.03), M.dark, -3.45, 1.28, 0.95);
  addPair(rbox(2.42, 0.30, 0.06, 0.02), M.dark, -3.45, 1.14, 1.25);
  addPair(rbox(0.03, 0.48, 0.58, 0.015), M.rubber, -4.98, 0.32, 0.95);

  // coda: armadio pompe, arrotolatubo, paraincastro, fanali, targa ADR
  add(rbox(0.70, 1.05, 1.95, 0.06), M.steel, -5.36, 1.62, 0);
  add(rbox(0.05, 0.06, 0.50, 0.02), M.chrome, -5.73, 1.62, 0);
  add(new THREE.TorusGeometry(0.36, 0.10, 10, 26), M.dark, -5.40, 2.42, 0, { ry: Math.PI / 2 });
  add(rbox(0.10, 0.16, 2.10, 0.04), M.steel, -5.62, 0.62, 0);
  addPair(rbox(0.10, 0.72, 0.14, 0.04), M.steel, -5.50, 0.98, 0.80);
  addPair(rbox(0.09, 0.46, 0.22, 0.04), M.tail, -5.74, 1.05, 0.92);
  add(rbox(0.05, 0.26, 0.40, 0.02), M.adr, -5.74, 1.62, 0.62);

  /* ---------- scritta RGF ambiente sulla cisterna ---------- */
  const brandTex = makeBrandTexture();
  const brandMat = new THREE.MeshBasicMaterial({
    map: brandTex, transparent: true, depthWrite: false,
  });
  const brand = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.72), brandMat);
  brand.position.set(-1.5, tankY + 0.05, 1.062);
  truck.add(brand);
  const brandBack = brand.clone();
  brandBack.position.z = -1.062;
  brandBack.rotation.y = Math.PI;
  truck.add(brandBack);

  /* ---------- ruote ---------- */
  // geometrie condivise fra le 12 ruote
  const gTire = {};
  const tireGeo = (w) => (gTire[w] ||= new THREE.CylinderGeometry(0.54, 0.54, w, 30));
  const gBead   = new THREE.TorusGeometry(0.505, 0.045, 8, 30);
  const gRim    = new THREE.CylinderGeometry(0.33, 0.33, 0.10, 24);
  const gCap    = new THREE.CylinderGeometry(0.12, 0.115, 0.12, 16);
  const gNut    = new THREE.CylinderGeometry(0.028, 0.028, 0.16, 8);
  const gVent   = new THREE.CylinderGeometry(0.075, 0.075, 0.16, 12);

  // face: +1/-1 = lato cerchio a vista, 0 = ruota interna del gemellato
  // fine: fori e bulloni sul cerchio — solo sull'avantreno, sul carrello
  // sarebbero sotto il pixel e costerebbero 60 draw call per nulla
  function wheel(x, z, w, face, fine = false) {
    const g = new THREE.Group();
    const t = new THREE.Mesh(tireGeo(w), M.tire);
    t.rotation.x = Math.PI / 2;
    t.castShadow = t.receiveShadow = true;
    g.add(t);
    if (D) [w / 2 - 0.02, -w / 2 + 0.02].forEach((o) => {
      const b = new THREE.Mesh(gBead, M.tire);
      b.position.z = o;
      g.add(b);
    });
    if (face) {
      const s = face * (w / 2 - 0.03);
      const rim = new THREE.Mesh(gRim, M.hub);
      rim.rotation.x = Math.PI / 2;
      rim.position.z = s;
      rim.castShadow = true;
      g.add(rim);
      const cap = new THREE.Mesh(gCap, M.chrome);
      cap.rotation.x = Math.PI / 2;
      cap.position.z = s + face * 0.08;
      g.add(cap);
      if (D && fine) for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        const v = new THREE.Mesh(gVent, M.dark);
        v.rotation.x = Math.PI / 2;
        v.position.set(Math.cos(a) * 0.21, Math.sin(a) * 0.21, s);
        g.add(v);
        const n = new THREE.Mesh(gNut, M.steel);
        n.rotation.x = Math.PI / 2;
        n.position.set(Math.cos(a + 0.63) * 0.135, Math.sin(a + 0.63) * 0.135, s + face * 0.03);
        g.add(n);
      }
    }
    g.position.set(x, 0.54, z);
    truck.add(g);
    return g;
  }

  // sterzante: ruote singole
  wheel(3.72, 1.05, 0.34, 1, true);
  wheel(3.72, -1.05, 0.34, -1, true);
  // motore + tre assi del carrello: gemellate, con trave d'assale a vista
  [1.32, -2.55, -3.45, -4.35].forEach((x, i) => {
    const fine = i === 0;
    wheel(x, 0.80, 0.26, 0);
    wheel(x, 1.09, 0.26, 1, fine);
    wheel(x, -0.80, 0.26, 0);
    wheel(x, -1.09, 0.26, -1, fine);
    add(new THREE.CylinderGeometry(0.09, 0.09, 2.10, 12), M.dark, x, 0.54, 0, { rz: Math.PI / 2 });
  });

  truck.position.y = 0;
  truck.rotation.y = -0.62;

  /* ---------- piazzale ---------- */
  // Il disco sfuma in trasparenza sul bordo. Con un piano opaco da 300 unita'
  // il piazzale finiva di netto e disegnava una riga orizzontale su tutta la
  // larghezza dell'hero, dove il 3D lasciava il posto al gradiente CSS.
  // Raggio 70 perche' la dissolvenza deve cadere dentro il campo visivo.
  const groundFade = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.34, "rgba(255,255,255,1)");
    g.addColorStop(0.72, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(70, 64),
    // asfalto umido: ora che l'ambiente e' vero, il piazzale ne raccoglie
    // il gradiente invece di restare una campitura piatta. envMapIntensity
    // tenuta bassa: a 0.9 il piazzale rifletteva l'orizzonte ambrato e
    // staccava dal fondo con una linea netta.
    // Golden hour: il piazzale umido raccoglie il cielo dorato invece del
    // grigio-blu. Tinta di base calda (bronzo scurissimo) e envMapIntensity un
    // filo più alta, così sotto il mezzo l'asfalto ha lo stesso lavaggio d'oro
    // dell'orizzonte — ma tenuta bassa perché non torni a essere un faro.
    new THREE.MeshStandardMaterial({
      color: 0x17110a, metalness: 0.5, roughness: 0.40, envMapIntensity: 0.7,
      alphaMap: groundFade, transparent: true,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ============================================================
     STRADA E DINTORNI
     Il mezzo stava su un disco di asfalto sospeso nel nero: senza una
     carreggiata sotto le ruote e senza niente all'orizzonte la scala non
     si legge e l'autoarticolato sembra un modellino in una stanza vuota.
     Tutto ciò che appartiene al luogo vive in questo gruppo, che segue
     l'imbardata del mezzo: così la corsia resta allineata alle ruote
     anche mentre il camion gira, e la rotazione da showroom si legge
     come una piattaforma che ruota, non come un mezzo che sbanda fuori
     strada. Il disco del piazzale resta fuori dal gruppo: è a simmetria
     radiale, ruotarlo non cambierebbe un pixel.
     ============================================================ */
  const world = new THREE.Group();
  // allineato subito: se il canvas nasce fuori dallo schermo animate() esce
  // prima di assegnarla, e il primo fotogramma mostrerebbe la strada di
  // sbieco rispetto alle ruote
  world.rotation.y = truck.rotation.y;
  scene.add(world);

  // Carreggiata a due corsie da 3.9 m. Il camion sta su Z 0 e non si sposta,
  // quindi è la strada a spostarsi: l'asse cade a Z 2.05 e la corsia opposta
  // resta verso la camera, dove la segnaletica si legge di taglio.
  const ROAD_Z = 2.05;
  const ASF = 4.45;      // semilarghezza dell'asfalto
  const PLANE_W = 12.9;  // asfalto + banchine di ghiaia che sfumano nel piazzale
  const ROAD_LEN = 198;  // 22 campate da 9 m: 3 di tratto + 6 di vuoto
  const vOf = (z) => (ROAD_Z + PLANE_W / 2 - z) / PLANE_W;

  const roadTex = makeRoadTexture(isSmall ? 512 : 1024);
  roadTex.colorSpace = THREE.SRGBColorSpace;
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.repeat.set(ROAD_LEN / 9, 1);
  // l'asfalto si vede di scorcio: senza anisotropia la segnaletica sfarina
  // in una poltiglia grigia a pochi metri dalla camera
  roadTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_LEN, PLANE_W),
    new THREE.MeshStandardMaterial({
      map: roadTex,
      // le testate si dissolvono invece di finire: a 55 m la nebbia ha già
      // mangiato tutto e sotto resta il gradiente CSS dell'hero
      alphaMap: makeEndFade(),
      transparent: true,
      // Il diffuso di una direzionale su un piano è uniforme: la macchia
      // chiara che invadeva l'angolo in basso a sinistra era il lobo speculare
      // della luce di riempimento più il riflesso d'ambiente. Su 200 m² di
      // piano anche un lobo largo diventa un faro: metalness bassa e roughness
      // alta lo spalmano. envMapIntensity risalita appena (0.40) perché all'ora
      // d'oro l'asfalto ha un velo caldo che riflette il cielo verso l'orizzonte.
      metalness: 0.07, roughness: 0.70, envMapIntensity: 0.40,
    })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.012, ROAD_Z);
  road.receiveShadow = true;   // senza questo l'ombra del mezzo sparisce
  road.renderOrder = 2;
  world.add(road);

  // Terreno ai lati. Il disco sotto è della stessa tinta a destra e a
  // sinistra dell'asfalto, e la strada sembrava disegnata su un tavolo:
  // queste due campiture danno la banchina erbosa e il piano di fuga verso
  // i capannoni. Sfumano dal lato opposto alla strada.
  const field = (len, w, x, z, color, verso) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(len, w),
      new THREE.MeshStandardMaterial({
        color, metalness: 0.05, roughness: 0.94, envMapIntensity: 0.3,
        alphaMap: makeSideFade(verso), transparent: true,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.006, z);
    m.renderOrder = 1;
    world.add(m);
    return m;
  };
  // Il lato strada di ogni campitura passa *sotto* l'asfalto e non si fermano
  // a filo della banchina: lì la ghiaia è già dissolta e il bordo opaco del
  // terreno disegnerebbe la riga netta parallela alla corsia che si stava
  // cercando di evitare.
  field(240, 67.6, -8, -34.8, 0x111509, false);  // campo aperto verso l'impianto
  field(240, 21.4, -8, 15.7, 0x0c1010, true);    // banchina in primo piano

  /* ---------- alone di contatto sotto il mezzo ----------
     L'ombra proiettata c'è, ma il sole è a 30° e la butta tutta in avanti:
     sotto al telaio restava asfalto in piena luce d'ambiente e il camion
     galleggiava. Questa è l'occlusione di contatto, dipinta. */
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(13.6, 5.0),
    // la dissolvenza dell'alone sta nel canale alpha della texture, non nella
    // luminanza: va passata come map, un alphaMap ne leggerebbe il verde —
    // che è 255 su tutto il disco — e darebbe una macchia dal bordo netto
    new THREE.MeshBasicMaterial({
      color: 0x04070a, map: makeGlowTexture("#ffffff"),
      transparent: true, opacity: 0.62, depthWrite: false,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(-0.4, 0.03, 0);
  contact.renderOrder = 5;
  world.add(contact);

  /* ---------- helper per l'arredo del luogo ---------- */
  // niente ombre su nulla di tutto questo: sta fuori dal cono della shadow
  // camera e pagherebbe soltanto draw call
  const addW = (geo, mat, x, y, z, opts = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (opts.rx) m.rotation.x = opts.rx;
    if (opts.ry) m.rotation.y = opts.ry;
    if (opts.rz) m.rotation.z = opts.rz;
    world.add(m);
    return m;
  };

  // Tutto molto più scuro di quanto sembri giusto sulla carta: la luce di
  // riempimento arriva dal lato camera, quindi ogni volume di sfondo la prende
  // sulla faccia che guardiamo. Con le tinte di partenza (lamiera 0x1a2126,
  // fronde 0x0d1712) capannoni e siepe leggevano come cartone grigio in piena
  // luce invece che come sagome contro il crepuscolo.
  const W = {
    lamiera: new THREE.MeshStandardMaterial({ color: 0x0d1215, metalness: 0.22, roughness: 0.78, envMapIntensity: 0.35 }),
    // il colmo serve solo a staccare il volume dal cielo: acciaio smorzato,
    // con M.steel diventava una trave luminosa sospesa sull'orizzonte
    colmo:   new THREE.MeshStandardMaterial({ color: 0x4a5054, metalness: 0.55, roughness: 0.6, envMapIntensity: 0.5 }),
    rail:    new THREE.MeshStandardMaterial({ color: 0x767c81, metalness: 0.65, roughness: 0.5, envMapIntensity: 0.7 }),
    muro:    new THREE.MeshStandardMaterial({ color: 0x0e1215, metalness: 0.05, roughness: 0.92 }),
    fronda:  new THREE.MeshStandardMaterial({ color: 0x08110c, metalness: 0.0, roughness: 1.0 }),
    // lucernari e finestre accese: dim, sono a 40 m dietro la foschia
    finestra:new THREE.MeshStandardMaterial({ color: 0x2b2418, emissive: 0xffb267, emissiveIntensity: 0.4 }),
    // Sodio quasi spento: all'ora d'oro il sole è ancora sull'orizzonte e i
    // lampioni si stanno appena accendendo. A piena emissione (2.6) l'immagine
    // ricadeva nel notturno e uccideva la dominante calda del sole.
    sodio:   new THREE.MeshStandardMaterial({ color: 0xffddb0, emissive: 0xffab55, emissiveIntensity: 0.9 }),
    faro:    new THREE.MeshStandardMaterial({ color: 0x22282c, metalness: 0.6, roughness: 0.5 }),
    beacon:  new THREE.MeshStandardMaterial({ color: 0x3a0a0a, emissive: 0xff2a1e, emissiveIntensity: 1.4 }),
  };

  /* ---------- barriera stradale sul lato cieco ----------
     La fascia d'acciaio raccoglie la luce di stacco e disegna una linea di
     fuga lungo la corsia: è quella linea, più dei capannoni, a dare la
     profondità e a dire quanto è lungo il mezzo. */
  // Finisce a X +2, dietro la cabina: tirata fino in primo piano diventava
  // una trave chiara che attraversava l'inquadratura all'altezza del telaio.
  const RAIL_Z = -3.6;
  addW(new THREE.BoxGeometry(90, 0.30, 0.06), W.rail, -43, 0.68, RAIL_Z);
  addW(new THREE.BoxGeometry(90, 0.07, 0.14), W.rail, -43, 0.84, RAIL_Z);
  {
    const n = isSmall ? 12 : 23;
    const passo = 90 / n;
    const posts = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.13, 0.80, 0.11), W.muro, n
    );
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      mtx.setPosition(-88 + i * passo, 0.40, RAIL_Z - 0.04);
      posts.setMatrixAt(i, mtx);
    }
    posts.instanceMatrix.needsUpdate = true;
    // il bounding sphere di una InstancedMesh non tiene conto delle istanze:
    // lasciata culled, la fila spariva appena il centro usciva dal frustum
    posts.frustumCulled = false;
    world.add(posts);
  }

  /* ---------- siepe dietro la barriera ---------- */
  {
    const n = isSmall ? 14 : 28;
    const bush = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), W.fronda, n);
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const asseY = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const sc = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      pos.set(-72 + (i * 84) / n + Math.random() * 1.4, 0.55 + Math.random() * 0.2, -7.4 + Math.random() * 0.9);
      sc.set(1.5 + Math.random() * 0.7, 0.85 + Math.random() * 0.35, 1.1 + Math.random() * 0.4);
      q.setFromAxisAngle(asseY, Math.random() * 3);
      bush.setMatrixAt(i, mtx.compose(pos, q, sc));
    }
    bush.instanceMatrix.needsUpdate = true;
    bush.frustumCulled = false;
    world.add(bush);
  }

  /* ---------- lampioni al sodio ----------
     Sono la stessa sorgente che illumina la mappa d'ambiente cotta in
     Blender: qui prendono corpo, così i riflessi puntiformi sull'inox hanno
     finalmente un oggetto in scena da cui provenire. */
  const LAMP_Z = -5.4;
  // il lampione vicino sta a -2 e non davanti alla cabina: il palo sale nel
  // varco fra cabina e cisterna invece di tagliare la calandra, che è il
  // punto dove va l'occhio
  // La camera guarda il mezzo dal quarto anteriore destro: in quadro c'è la
  // fascia di strada da X +8 a X -80 circa (proiettata a mano, la carreggiata
  // esce dal bordo sinistro prima di raggiungere l'orizzonte). Tutto l'arredo
  // sta lì: quello che avevo messo oltre X +15 era geometria pagata e mai vista.
  const lampX = isSmall ? [-42, -22, -2] : [-82, -62, -42, -22, -2];
  lampX.forEach((x, i) => {
    const h = 8.5 + (i % 2) * 0.4;
    addW(new THREE.CylinderGeometry(0.10, 0.15, h, 10), W.faro, x, h / 2, LAMP_Z);
    addW(new THREE.CylinderGeometry(0.075, 0.075, 2.0, 8), W.faro, x, h + 0.12, LAMP_Z + 1.0, { rx: Math.PI / 2 - 0.13 });
    addW(rbox(0.60, 0.15, 0.34, 0.05), W.faro, x, h + 0.23, LAMP_Z + 1.95);
    addW(new THREE.BoxGeometry(0.46, 0.04, 0.24), W.sodio, x, h + 0.14, LAMP_Z + 1.95);

    // alone sulla lampada + pozza calda sull'asfalto: la luce vera la fa
    // solo il lampione accanto al mezzo, gli altri sono dipinti
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture("#ffb457"), transparent: true, opacity: 0.16,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(2.1, 2.1, 1);
    glow.position.set(x, h + 0.1, LAMP_Z + 1.95);
    world.add(glow);

    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 13),
      new THREE.MeshBasicMaterial({
        map: makeGlowTexture("#ff9c46"), transparent: true, opacity: 0.07,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.045, LAMP_Z + 3.4);
    pool.renderOrder = 4;
    world.add(pool);

    if (!isSmall && x === -2) {
      // appena accesa: la chiave resta il sole, il lampione è un accento
      const l = new THREE.PointLight(0xffb45f, 9, 30, 2);
      l.position.set(x, h + 0.1, LAMP_Z + 1.95);
      world.add(l);
    }
  });

  /* ---------- pioppi ---------- */
  // niente pioppi dentro la sagoma dei capannoni: sono i filari davanti.
  // Il raggio varia per pianta: a raggio fisso erano sette coni identici, e
  // sette triangoli uguali in fila si leggono come una decorazione.
  const pioppi = [
    [-38, -13.5, 9.5, 1.7], [-24, -17, 8.0, 1.3], [-9, -11.5, 10.5, 1.9],
    [-16, -16, 8.6, 1.5], [-58, -12, 9.8, 1.6], [-66, -14, 7.6, 2.0],
    [-45, -21, 10.2, 1.4],
  ];
  pioppi.forEach(([x, z, h, r], i) => {
    if (isSmall && i % 2) return;
    addW(new THREE.ConeGeometry(r, h, 7), W.fronda, x, h / 2 + 0.5, z);
    addW(new THREE.CylinderGeometry(0.14, 0.18, 1.2, 6), W.muro, x, 0.6, z);
  });

  /* ---------- capannoni dell'impianto ----------
     Silhouette in lamiera con la banda dei lucernari accesa. Restano
     lontano dall'asse della strada: la fuga della carreggiata deve finire
     nel sole, non contro un muro. */
  function capannone(x, z, len, h, dep, colmo = true) {
    addW(new THREE.BoxGeometry(len, h, dep), W.lamiera, x, h / 2, z);
    // colmo in lamiera chiara: è il filo che prende la luce di stacco e
    // stacca il volume dal cielo. Sul fondale da 104 m va omesso: quel filo
    // diventa una trave luminosa che taglia l'orizzonte da parte a parte.
    if (colmo) addW(new THREE.BoxGeometry(len + 0.7, 0.16, dep + 0.7), W.colmo, x, h + 0.08, z);
    // Lucernari in tre campate e non in una fascia sola: continua per 40 m
    // leggeva come un tubo al neon che attraversava mezza inquadratura, non
    // come le finestre di un capannone.
    if (!isSmall) [-0.29, 0, 0.29].forEach((k) =>
      addW(new THREE.BoxGeometry(len * 0.22, 0.5, 0.08), W.finestra,
           x + len * k, h * 0.66, z + dep / 2 + 0.05)
    );
  }
  capannone(-74, -26, 46, 9.5, 18);
  capannone(-32, -32, 34, 7.0, 16);
  // questo cade dietro la cabina: tenuto basso e arretrato, a 10 m d'altezza
  // diventava un muro sopra il mezzo invece di un fondo
  capannone(2, -29, 30, 7.5, 20);
  if (!isSmall) capannone(-24, -48, 104, 6.0, 22, false);  // fondale che chiude l'orizzonte

  // silos e ciminiera: verticali contro un orizzonte tutto orizzontale
  [[-52, -14], [-46.4, -14]].forEach(([x, z]) =>
    addW(new THREE.CylinderGeometry(2.1, 2.1, 12, 16), W.lamiera, x, 6, z)
  );
  addW(new THREE.CylinderGeometry(0.9, 1.15, 21, 14), W.lamiera, -70, 10.5, -27);
  addW(new THREE.SphereGeometry(0.22, 8, 6), W.beacon, -70, 21.3, -27);

  /* ---------- sole al tramonto ----------
     Sta nel gruppo della strada, non in scena: le coordinate sono le stesse
     di prima ruotate nel gruppo (a riposo cade dov'era, -11 / 1.1 / -9), ma
     così la carreggiata continua a puntare al sole anche mentre il mezzo
     gira. È la stessa direzione da cui arriva sunLight. */
  // Il sole dell'ora d'oro: disco caldo e luminoso appoggiato all'orizzonte,
  // il punto focale dell'intera immagine. Doppio sprite additivo — un cuore
  // quasi bianco-oro incandescente dentro un alone ambra ampio — così il
  // bagliore fiorisce come una vera sorgente in controluce invece di restare
  // una macchia piatta. Additivo: si somma al cielo CSS dietro il canvas.
  const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture("#ffb968"), transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sunHalo.scale.set(15, 15, 1);
  sunHalo.position.set(-14.2, 2.1, -0.9);
  world.add(sunHalo);

  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture("#ffe8bf"), transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sun.scale.set(6.2, 6.2, 1);
  sun.position.set(-14.2, 2.0, -0.85);
  world.add(sun);

  /* ---------- texture del manto stradale ----------
     Asfalto e segnaletica in un'unica tavola che si ripete ogni 9 m: un mesh
     per tratto di mezzeria sarebbe stato un mesh ogni 9 m di strada. */
  function makeRoadTexture(px) {
    const c = document.createElement("canvas");
    c.width = c.height = px;
    const g = c.getContext("2d");
    const yOf = (z) => (1 - vOf(z)) * px;   // z del mondo -> riga del canvas
    const ppm = px / PLANE_W;               // pixel per metro in larghezza
    const ppl = px / 9;                     // pixel per metro in lunghezza

    // prima la ghiaia su tutta la tavola, poi l'asfalto sopra: così il bordo
    // dell'asfalto resta netto come su una strada vera, ed è la ghiaia a
    // sfumare nel piazzale
    // Albedo bassa: misurato in render, con la base a #191e22 l'asfalto
    // usciva più chiaro delle parti scure del mezzo e la carreggiata era la
    // cosa più luminosa dell'inquadratura. Il bitume asciutto sta sotto il 6%
    // di riflettanza, e qui ci sono tre luci che lo prendono di piatto.
    // basi in charcoal caldo, non più grigio-blu: sotto il sole radente
    // dell'ora d'oro il bitume tende al bruno, non al ferro
    g.fillStyle = "#100c08";
    g.fillRect(0, 0, px, px);
    g.fillStyle = "#13100a";
    g.fillRect(0, yOf(ROAD_Z - ASF), px, 2 * ASF * ppm);

    // grana del bitume: rumore a un quarto di risoluzione riscalato in
    // overlay. A piena risoluzione costa sedici volte tanto e a questa
    // inquadratura non si distingue.
    const n = document.createElement("canvas");
    const nq = Math.max(64, px >> 2);
    n.width = n.height = nq;
    const nctx = n.getContext("2d");
    const img = nctx.createImageData(nq, nq);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 98 + Math.random() * 74;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
    g.globalCompositeOperation = "overlay";
    g.globalAlpha = 0.62;
    g.drawImage(n, 0, 0, px, px);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;

    // corsie di rotolamento: il bitume lucidato dalle gomme è più scuro, e
    // sono quelle due bande a dire che su questa strada passano dei camion
    [-1.0, 1.0, 3.1, 5.1].forEach((z) => {
      const a = yOf(z - 0.45), b = yOf(z + 0.45);
      const lg = g.createLinearGradient(0, a, 0, b);
      lg.addColorStop(0, "rgba(8,6,4,0)");
      lg.addColorStop(0.5, "rgba(8,6,4,0.5)");
      lg.addColorStop(1, "rgba(8,6,4,0)");
      g.fillStyle = lg;
      g.fillRect(0, a, px, b - a);
    });

    // segnaletica: vernice consumata, non bianco puro — a piena luminanza le
    // strisce bruciano e sembrano al neon (stessa scelta di 3d/bake_env.py)
    const riga = (z, h, da, a) => {
      // vernice consumata calda: sotto il sole d'oro il bianco della
      // segnaletica vira all'avorio, non resta grigio-verde freddo
      g.fillStyle = "#8f8672";
      g.fillRect(da * ppl, yOf(z) - (h * ppm) / 2, (a - da) * ppl, h * ppm);
    };
    riga(ROAD_Z + ASF - 0.55, 0.15, 0, 9);   // margine, lato camera
    riga(ROAD_Z - ASF + 0.55, 0.15, 0, 9);   // margine, lato barriera
    riga(ROAD_Z, 0.15, 0, 3);                // mezzeria: 3 m di tratto, 6 di vuoto

    // consumo della vernice: senza, le righe sono adesivi
    g.fillStyle = "rgba(19,15,10,0.55)";
    for (let i = 0; i < 260; i++) {
      const z = [ROAD_Z + ASF - 0.55, ROAD_Z - ASF + 0.55, ROAD_Z][i % 3];
      const u = (i % 3 === 2 ? Math.random() * 3 : Math.random() * 9) * ppl;
      g.fillRect(u, yOf(z) - (0.15 * ppm) / 2, Math.random() * 0.3 * ppl, 0.15 * ppm);
    }

    // le banchine si dissolvono nel piazzale: un bordo netto disegnerebbe due
    // righe parallele lungo tutta l'inquadratura
    g.globalCompositeOperation = "destination-out";
    [[ROAD_Z + PLANE_W / 2, ROAD_Z + ASF + 0.7], [ROAD_Z - PLANE_W / 2, ROAD_Z - ASF - 0.7]]
      .forEach(([fuori, dentro]) => {
        const a = yOf(fuori), b = yOf(dentro);
        const lg = g.createLinearGradient(0, a, 0, b);
        lg.addColorStop(0, "rgba(0,0,0,1)");
        lg.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = lg;
        g.fillRect(0, Math.min(a, b), px, Math.abs(b - a));
      });
    g.globalCompositeOperation = "source-over";

    const tex = new THREE.CanvasTexture(c);
    return tex;
  }

  /* dissolvenza sulle due testate della strada (lungo la lunghezza) */
  function makeEndFade() {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 4;
    const g = c.getContext("2d");
    const lg = g.createLinearGradient(0, 0, 256, 0);
    lg.addColorStop(0, "#000");
    lg.addColorStop(0.22, "#fff");
    lg.addColorStop(0.78, "#fff");
    lg.addColorStop(1, "#000");
    g.fillStyle = lg;
    g.fillRect(0, 0, 256, 4);
    return new THREE.CanvasTexture(c);
  }

  /* dissolvenza di un terreno laterale: opaco sul lato strada, via sull'altro.
     verso = true quando il lato strada è a v 1 (banchina in primo piano) */
  function makeSideFade(verso) {
    const c = document.createElement("canvas");
    c.width = 4; c.height = 256;
    const g = c.getContext("2d");
    const lg = g.createLinearGradient(0, 0, 0, 256);  // y 0 = v 1, y 256 = v 0
    (verso
      ? [[0, "#ffffff"], [0.42, "#e4e4e4"], [1, "#000000"]]
      : [[0, "#000000"], [0.62, "#eeeeee"], [1, "#ffffff"]]
    ).forEach(([t, col]) => lg.addColorStop(t, col));
    g.fillStyle = lg;
    g.fillRect(0, 0, 4, 256);
    return new THREE.CanvasTexture(c);
  }

  /* ---------- pulviscolo ambientale ----------
     All'ora d'oro il pulviscolo in controluce si accende: sono le particelle
     calde a fluttuare nel fascio del sole. Dominante oro, con una minoranza
     fredda che dà il senso di profondità dello strato d'aria. */
  const dust = makeDust(isSmall ? 140 : 300, 0xffca84, 0.5);
  const dustWarm = makeDust(isSmall ? 80 : 160, 0xa7c2dd, 0.22);
  scene.add(dust, dustWarm);

  function makeDust(count, color, opacity) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos.set([
        (Math.random() - 0.5) * 30,
        Math.random() * 9,
        (Math.random() - 0.5) * 18 - 3,
      ], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
      color, size: 0.045, transparent: true, opacity,
      depthWrite: false, blending: THREE.AdditiveBlending, map: makeGlowTexture("#ffffff"),
    }));
  }

  /* ---------- camera ---------- */
  function setCamera() {
    // si misura il canvas, non la finestra: l'hero è alto 100svh, che su
    // mobile è minore di innerHeight quando la barra URL è ritratta
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const aspect = w / h;
    camera.aspect = aspect;
    // Su schermi stretti il testo resta centrato e il mezzo va composto nella
    // fascia bassa, sotto al titolo. Da 1000px in su il testo passa a sinistra
    // (media query nel CSS) e il mezzo si sposta a destra.
    if (aspect < 0.8) {
      camera.userData.baseZ = 24.0; camera.userData.baseY = 3.0;
      camera.userData.lookY = 7.2; camera.fov = 46;
    } else if (aspect < 1.35) {
      camera.userData.baseZ = 20.0; camera.userData.baseY = 2.8;
      camera.userData.lookY = 6.0; camera.fov = 44;
    } else {
      camera.userData.baseZ = 16.6; camera.userData.baseY = 2.6;
      camera.userData.lookY = 3.9; camera.fov = 42;
    }

    // Lo spostamento laterale si fa con un view offset e non muovendo il
    // lookAt: ruotare la camera avrebbe inclinato anche l'orizzonte e le
    // ombre. Valori negativi su x spingono il soggetto verso destra.
    if (w >= 1000) camera.setViewOffset(w, h, -w * 0.20, h * 0.05, w, h);
    else camera.clearViewOffset();

    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false); // false: non tocca lo stile, ci pensa il CSS
  }
  setCamera();
  camera.position.set(0.4, camera.userData.baseY, camera.userData.baseZ);
  camera.lookAt(0.1, camera.userData.lookY, 0);

  /* ---------- interazione ---------- */
  const mouse = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let scrollY = 0;
  window.addEventListener("scroll", () => { scrollY = window.scrollY; }, { passive: true });
  // debounce: su mobile la barra URL che entra ed esce durante lo scroll
  // scatenerebbe una riallocazione continua del framebuffer WebGL
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setCamera, 150);
  }, { passive: true });

  /* ---------- loop ---------- */
  const clock = new THREE.Clock();
  let running = true;
  let rafId = 0;

  new IntersectionObserver(([entry]) => {
    const wasRunning = running;
    running = entry.isIntersecting;
    if (running && !wasRunning) animate();
    if (!running) cancelAnimationFrame(rafId);
  }, { threshold: 0 }).observe(canvas);

  // hook di ispezione, solo in sviluppo locale
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
    window.__rgf = { renderer, scene, camera, truck, ground, world, road };
  }

  function animate() {
    if (!running) return;
    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    smooth.x += (mouse.x - smooth.x) * 0.04;
    smooth.y += (mouse.y - smooth.y) * 0.04;

    // ingresso cinematografico: carrellata che si avvicina e si raddrizza
    const intro = Math.min(t / 2.8, 1);
    const introEase = 1 - Math.pow(1 - intro, 4);
    const introZ = (1 - introEase) * 5.5;
    const introY = (1 - introEase) * 1.4;
    const introRot = (1 - introEase) * 0.30;

    // leggera rotazione da showroom + parallasse mouse
    truck.rotation.y = -0.62 + introRot + Math.sin(t * 0.07) * 0.1 + smooth.x * 0.22 * introEase;
    truck.rotation.x = smooth.y * 0.03;

    // fluttuazione impercettibile della camera
    const sp = Math.min(scrollY / window.innerHeight, 1.4);
    camera.position.z = camera.userData.baseZ + introZ + Math.sin(t * 0.4) * 0.12 + sp * 2.6;
    camera.position.y = camera.userData.baseY + introY + Math.sin(t * 0.5) * 0.05 + sp * 0.6;
    camera.position.x = 0.4 + smooth.x * 0.35 * introEase;
    camera.lookAt(0.1, camera.userData.lookY - sp * 1.2, 0);

    // scroll: il mezzo scivola in basso
    truck.position.y = -sp * 1.6;
    ground.position.y = -sp * 1.6;
    // strada, arredo e sole seguono il mezzo: imbardata compresa, altrimenti
    // le ruote finiscono fuori corsia appena il camion gira
    world.rotation.y = truck.rotation.y;
    world.position.y = -sp * 1.6;

    // respiro del sole: cuore e alone pulsano in controfase leggera, come la
    // rifrazione dell'aria calda sopra l'orizzonte all'ora d'oro
    const s = 6.2 + Math.sin(t * 0.8) * 0.3;
    sun.scale.set(s, s, 1);
    const sh = 15 + Math.sin(t * 0.6 + 1) * 0.6;
    sunHalo.scale.set(sh, sh, 1);

    dust.rotation.y = t * 0.01;
    dustWarm.rotation.y = -t * 0.008;

    renderer.render(scene, camera);
  }
  animate();

  /* ---------- texture scritta laterale ---------- */
  function makeBrandTexture() {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 256;
    const ctx = c.getContext("2d");
    const draw = () => {
      ctx.clearRect(0, 0, 1024, 256);
      ctx.textBaseline = "middle";
      ctx.font = "800 160px Sora, system-ui, sans-serif";
      // bianca, non piu' quasi nera: la fascia di mantello che ospita la
      // scritta e' la piu' scura del cilindro, e il testo antracite ci
      // spariva dentro
      ctx.fillStyle = "rgba(244,249,246,0.97)";
      ctx.fillText("RGF", 40, 126);
      ctx.font = "600 96px Sora, system-ui, sans-serif";
      ctx.fillStyle = "rgba(95,180,229,0.97)";
      ctx.fillText("ambiente", 410, 138);
      tex.needsUpdate = true;
    };
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    draw();
    if (document.fonts?.ready) document.fonts.ready.then(draw);
    return tex;
  }
}

/* Environment map equirettangolare "golden hour" disegnata su canvas.
   È l'unica sorgente di riflessi per cromo e inox, quindi non è un ripiego:
   cupola ambra calda, orizzonte incandescente, disco del sole basso e punti
   luce caldi lontani perché il metallo abbia scintille speculari da riflettere. */
function makeGoldenEnvironment(pmrem) {
  const W = 2048, H = 1024, HOR = 512;   // orizzonte a metà tela
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  // Cupola: dallo zenit ambra tenue giù fino alla fascia incandescente
  // dell'orizzonte. All'ora d'oro il cielo non è azzurro, è un lavaggio caldo
  // che si accende verso il sole.
  const sky = ctx.createLinearGradient(0, 0, 0, HOR);
  sky.addColorStop(0.00, "#5c6a83");   // zenit: appena freddo, dà respiro
  sky.addColorStop(0.45, "#b98a63");
  sky.addColorStop(0.74, "#e6a866");
  sky.addColorStop(0.90, "#ffcf86");
  sky.addColorStop(1.00, "#ffe6b0");   // fascia calda a filo d'orizzonte
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HOR);

  // Terra: rimbalzo caldo, non nero. È ciò che impedisce alla pancia dei
  // cilindri cromati e all'ombra della cisterna di leggersi come vetro nero.
  const gnd = ctx.createLinearGradient(0, HOR, 0, H);
  gnd.addColorStop(0.00, "#7a5a3a");
  gnd.addColorStop(0.30, "#4a3826");
  gnd.addColorStop(1.00, "#241a12");
  ctx.fillStyle = gnd;
  ctx.fillRect(0, HOR, W, H - HOR);

  // Silhouette dei capannoni sull'orizzonte: danno all'inox qualcosa da
  // rispecchiare oltre al cielo piatto, così la fiancata non è un gradiente
  ctx.fillStyle = "#2c2016";
  let x = 0;
  while (x < W) {
    const bw = 60 + Math.random() * 150;
    const bh = 18 + Math.random() * 60;
    ctx.fillRect(x, HOR - bh, bw - 6, bh);
    x += bw;
  }

  // Disco del sole basso, sul lato che la camera vede riflesso sui cromi.
  // Alone ampio e caldo: è il picco speculare che accende la calandra.
  const sx = W * 0.30, sy = HOR - 24;
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 360);
  glow.addColorStop(0.00, "rgba(255,244,214,1)");
  glow.addColorStop(0.12, "rgba(255,214,150,0.95)");
  glow.addColorStop(0.40, "rgba(255,170,92,0.45)");
  glow.addColorStop(1.00, "rgba(255,150,70,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, 70);
  core.addColorStop(0, "rgba(255,252,238,1)");
  core.addColorStop(1, "rgba(255,240,200,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, W, H);

  // Punti luce caldi lontani (finestre/lampioni accesi controluce): scintille
  // speculari puntiformi sull'inox satinato
  ctx.fillStyle = "rgba(255,208,150,0.9)";
  for (let i = 0; i < 22; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * W, HOR - Math.random() * 30 - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const env = pmrem.fromEquirectangular(tex);
  tex.dispose();
  return env;
}

/* ============================================================
   Scatola con spigoli raccordati.
   BoxGeometry segmentata, poi ogni vertice viene proiettato sul
   guscio a distanza r dalla scatola "interna" (w-2r, h-2r, d-2r):
   le facce restano piatte, gli spigoli diventano un raccordo.
   Le normali si ricalcolano dalla direzione di proiezione, quindi
   il raccordo si ombreggia liscio anche con pochi segmenti.
   ============================================================ */
function roundedBox(w, h, d, r = 0.08, seg = 3) {
  const geo = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  r = Math.min(r, w / 2, h / 2, d / 2);
  const ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r;
  const v = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const clamp = (t, lim) => Math.max(-lim, Math.min(lim, t));

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.set(v.x * w, v.y * h, v.z * d);
    c.set(clamp(v.x, ix), clamp(v.y, iy), clamp(v.z, iz));
    n.subVectors(v, c);
    if (n.lengthSq() > 1e-12) {
      n.normalize();
      v.copy(c).addScaledVector(n, r);
      nor.setXYZ(i, n.x, n.y, n.z);
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  return geo;
}

/* texture radiale morbida (sole / pulviscolo) */
function makeGlowTexture(color) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(0.35, color + "99");
  g.addColorStop(1, color + "00");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
