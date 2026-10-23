import sharp from "sharp";

// Originalen ligger i assets/. Varje bild beskärs (left/top/width/height i
// originalets pixlar) och skalas till public/ som .webp + .jpg.
// Porträttets beskärning styr var solglasögon och krona hamnar (src/style.css,
// .shades/.crown) – ändras den måste de kalibreras om.
const images = [
  // Porträtt 3:4, ansiktet i övre halvan och paddans kant i nederkant
  { src: "assets/vilgot-padda.png", out: "public/vilgot-hero", crop: { left: 250, top: 20, width: 900, height: 1200 }, size: [600, 800] },
  { src: "assets/vilgot-labb.png", out: "public/vilgot-labb", crop: { left: 420, top: 60, width: 960, height: 1200 }, size: [480, 600] },
  { src: "assets/vilgot-titt.png", out: "public/vilgot-titt", crop: { left: 40, top: 240, width: 720, height: 900 }, size: [480, 600] },
];

for (const img of images) {
  const pipeline = sharp(img.src).extract(img.crop).resize(img.size[0], img.size[1]).flatten({ background: "#000" });
  await pipeline.clone().webp({ quality: 78 }).toFile(`${img.out}.webp`);
  await pipeline.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(`${img.out}.jpg`);
  console.log(`${img.src} -> ${img.out}.webp + .jpg (${img.size.join("×")})`);
}
