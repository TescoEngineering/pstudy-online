const fs = require("fs");
const path = require("path");

const FR =
  "https://upload.wikimedia.org/wikipedia/commons/c/c3/Flag_of_France.svg";
const BE =
  "https://upload.wikimedia.org/wikipedia/commons/6/65/Flag_of_Belgium.svg";
const SHAKE =
  "https://upload.wikimedia.org/wikipedia/commons/9/9d/Handshake_%283575000735%29.jpg";

function L(parts) {
  const a = [...parts];
  while (a.length < 9) a.push("");
  return a.slice(0, 9).join("\t");
}

const l1 = [
  L([
    "Bonjour !",
    "Goedemorgen! / Goedendag! / Hallo!",
    "",
    "",
    "",
    "",
    "",
    "A1 — oefen hardop, formeel (u). Thema: kennismaken. Volgende thema’s: straat, café, reserveren, taxi, winkel, …",
    "",
  ]),
  L([
    "Bonjour, madame, enchanté. Je m'appelle Martin.",
    "Goedemorgen, mevrouw, aangename kennismaking. Ik heet Martin.",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "Enchantée, monsieur. Je m'appelle Anna Dubois. En vous ?",
    "Aangename kennismaking, meneer. Ik heet Anna Dubois. En u?",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "Comment allez-vous aujourd'hui ?",
    "Hoe maakt u het vandaag?",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "Je vais bien, merci. Et vous ?",
    "Het gaat goed, dank u. En met u?",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L(["Très bien, merci.", "Heel goed, dank u.", "", "", "", "", "", "", ""]),
  L([
    "D'où venez-vous ?",
    "Waar komt u vandaan?",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "Je suis de France. En vous ?",
    "Ik ben uit Frankrijk. En u?",
    "",
    "",
    "",
    "",
    FR,
    "",
    "",
  ]),
  L([
    "Je suis de Belgique, j'apprends le français.",
    "Ik ben uit België, ik leer Frans.",
    "",
    "",
    "",
    "",
    BE,
    "",
    "",
  ]),
  L([
    "Bonne chance ! Bonne journée, madame! Au revoir !",
    "Succes! Nog een fijne dag, mevrouw! Tot ziens!",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
];

const voc = [
  L(["le nom", "de naam", "", "", "", "", "", "", ""]),
  L(["le prénom", "de voornaam", "", "", "", "", "", "", ""]),
  L(["une personne", "een persoon", "", "", "", "", "", "", ""]),
  L(["un homme", "een man", "", "", "", "", "", "", ""]),
  L(["une femme", "een vrouw", "", "", "", "", "", "", ""]),
  L([
    "un ami",
    "een (mannelijke) vriend",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "une amie",
    "een (vrouwelijke) vriendin",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L(["le pays", "het land", "", "", "", "", "", "", ""]),
  L([
    "la France",
    "Frankrijk (als land)",
    "",
    "",
    "",
    "",
    FR,
    "Vlag: Frankrijk (past bij de term).",
    "",
  ]),
  L([
    "la Belgique",
    "België (als land)",
    "",
    "",
    "",
    "",
    BE,
    "Vlag: België (past bij de term).",
    "",
  ]),
  L(["le français", "het Frans", "", "", "", "", "", "", ""]),
  L(["le néerlandais", "het Nederlands", "", "", "", "", "", "", ""]),
  L([
    "le bonjour",
    "de begroeting / “hallo”",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "le bonsoir",
    "de avondbegroeting (“goedenavond”)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "un matin",
    "een ochtend (le matin = ’s ochtends)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "un soir",
    "een avond (le soir = ’s avonds)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "une journée",
    "een dag (werkdag / korte periode overdag)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "une poignée de main",
    "een handdruk (zo begroet je)",
    "",
    "",
    "",
    "",
    SHAKE,
    "Afbeelding: handdruk = wat de Franse zin letterlijk bedoelt.",
    "",
  ]),
  L(["la conversation", "het gesprek", "", "", "", "", "", "", ""]),
  L([
    "une introduction",
    "een korte voorstelling / introductie",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "une rencontre",
    "een ontmoeting (eerste keer)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "le plaisir",
    "het plezier (“avec plaisir” = met plezier)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "madame",
    "mevrouw (titel + naam of alleen als aanspreking)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L(["monsieur", "meneer (id.)", "", "", "", "", "", "", ""]),
  L([
    "mademoiselle",
    "juffrouw / mejuffrouw (informeler, minder gebruikelijk op het werk)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "merci",
    "dank u / dank je (vaak zonder artikel als interjectie)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "s’il vous plaît",
    "alstublieft (beleefd, met u)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L(["la politesse", "de beleefdheid", "", "", "", "", "", "", ""]),
  L(["le respect", "het respect", "", "", "", "", "", "", ""]),
  L([
    "le début",
    "het begin (van het gesprek)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L(["la fin", "het einde", "", "", "", "", "", "", ""]),
  L([
    "les adieux (m. pl.)",
    "afscheid nemen (formeler; “faire ses adieux”)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "au revoir (formule)",
    "tot ziens (vaste afscheidszin; geen lidwoord in de zin)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "à bientôt (formule)",
    "tot gauw / tot snel (vaste zin)",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
  L([
    "Enchanté. / Enchantée. (formule)",
    "Aangename kennismaking (bij de eerste kennismaking) — m./v. vorm.",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
];

// A1, situations du quotidien: directions, café, réserver (voir lessons-a1-everyday.cjs)
const {
  l2,
  voc2,
  gram2,
  l3,
  voc3,
  gram3,
  l4,
  voc4,
  gram4,
  l5,
  voc5,
  gram5,
} = require(path.join(__dirname, "lessons-a1-everyday.cjs"))(L);

// Lijst 4–: les 6–7 (frituur, OV) + vanaf 8 één per keer in lessons-a1-8-21.cjs
const extraSitu6plus = require(path.join(
  __dirname,
  "lessons-a1-situations-4-20.cjs"
))(L);
const extraSitu8plus = require(path.join(__dirname, "lessons-a1-8-21.cjs"))(L);
const a1SituLessons = [...extraSitu6plus, ...extraSitu8plus];

const dir = __dirname;
// No trailing newline after last line — avoids a spurious empty line on \n split
fs.writeFileSync(path.join(dir, "lesson-01-se-rencontrer.txt"), l1.join("\n"));
fs.writeFileSync(path.join(dir, "lesson-01a-vocabulaire.txt"), voc.join("\n"));
fs.writeFileSync(
  path.join(dir, "lesson-02-demander-son-chemin.txt"),
  l2.join("\n")
);
fs.writeFileSync(path.join(dir, "lesson-02a-vocabulaire.txt"), voc2.join("\n"));
fs.writeFileSync(path.join(dir, "lesson-02b-grammaire.txt"), gram2.join("\n"));
fs.writeFileSync(path.join(dir, "lesson-03-au-cafe.txt"), l3.join("\n"));
fs.writeFileSync(path.join(dir, "lesson-03a-vocabulaire.txt"), voc3.join("\n"));
fs.writeFileSync(path.join(dir, "lesson-03b-grammaire.txt"), gram3.join("\n"));
fs.writeFileSync(
  path.join(dir, "lesson-04-reserver-table-restaurant.txt"),
  l4.join("\n")
);
fs.writeFileSync(path.join(dir, "lesson-04a-vocabulaire.txt"), voc4.join("\n"));
fs.writeFileSync(path.join(dir, "lesson-04b-grammaire.txt"), gram4.join("\n"));
fs.writeFileSync(
  path.join(dir, "lesson-05-supermarche-caisse.txt"),
  l5.join("\n")
);
fs.writeFileSync(path.join(dir, "lesson-05a-vocabulaire.txt"), voc5.join("\n"));
fs.writeFileSync(path.join(dir, "lesson-05b-grammaire.txt"), gram5.join("\n"));
for (const s of a1SituLessons) {
  const n = String(s.num).padStart(2, "0");
  const base = `lesson-${n}-${s.slug}.txt`;
  fs.writeFileSync(path.join(dir, base), s.l.join("\n"));
  fs.writeFileSync(
    path.join(dir, `lesson-${n}a-vocabulaire.txt`),
    s.voc.join("\n")
  );
  fs.writeFileSync(
    path.join(dir, `lesson-${n}b-grammaire.txt`),
    s.gram.join("\n")
  );
}
console.log(
  "A1: l1",
  l1.length,
  "voc1",
  voc.length,
  "l2–l5",
  l2.length,
  l3.length,
  l4.length,
  l5.length,
  "situ+",
  a1SituLessons.length
);
