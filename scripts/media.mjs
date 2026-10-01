// Prepara film e foto per il sito, da sorgenti/ a media/.
//   node scripts/media.mjs
// Usa ffmpeg-static e sharp di insolita: qui non c'è un package.json e non
// serve averne uno per due strumenti che girano solo sul PC di Fabio.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");
const prestito = createRequire(join(radice, "../insolita/package.json"));
const ffmpeg = prestito("ffmpeg-static");
const sharp = prestito("sharp");

const fuori = join(radice, "media");
mkdirSync(fuori, { recursive: true });
const kb = (f) => Math.round(statSync(f).size / 1024) + " KB";

// Film: andata e ritorno (10 s, ciclo senza scatto), ritaglio 16:9 dal
// 3:2 che restituisce Kling, gradazione leggera, niente audio.
const film = ["serbatoi", "cisterna", "magazzino"];
const misure = [
  { suffisso: "", larghezza: 1280, crf: 27 },
  { suffisso: "-720", larghezza: 720, crf: 29 },
];
for (const nome of film) {
  const ingresso = join(radice, "sorgenti/film", nome + ".mp4");
  for (const m of misure) {
    const uscita = join(fuori, nome + m.suffisso + ".mp4");
    const filtro =
      `[0:v]crop=iw:iw*9/16,scale=${m.larghezza}:-2,` +
      `eq=contrast=1.04:saturation=0.92,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]`;
    execFileSync(ffmpeg, ["-v", "error", "-y", "-i", ingresso, "-filter_complex", filtro,
      "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", String(m.crf),
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", uscita]);
    console.log(uscita.slice(radice.length + 1), kb(uscita));
  }
  const poster = join(fuori, nome + "-poster.jpg");
  execFileSync(ffmpeg, ["-v", "error", "-y", "-i", ingresso, "-vf",
    "crop=iw:iw*9/16,scale=1280:-2,eq=contrast=1.04:saturation=0.92", "-frames:v", "1", "-q:v", "4", poster]);
  console.log(poster.slice(radice.length + 1), kb(poster));
}

// Foto dell'impianto dal sito vecchio (800 px, 2014). Non si ingrandiscono:
// si mostrano alla loro misura, in due tagli.
const foto = {
  trituratore: "rgf_1",
  piazzale: "rgf_4",
  cassoni: "rgf_8",
  motrice: "rgf_2",
};
for (const [nome, file] of Object.entries(foto)) {
  const ingresso = join(radice, "sorgenti/foto-sito-vecchio", file + ".jpg");
  for (const w of [800, 480]) {
    const uscita = join(fuori, `${nome}-${w}.webp`);
    await sharp(ingresso).resize({ width: w, withoutEnlargement: true })
      .modulate({ saturation: 0.92 }).webp({ quality: 78 }).toFile(uscita);
    console.log(uscita.slice(radice.length + 1), kb(uscita));
  }
}
