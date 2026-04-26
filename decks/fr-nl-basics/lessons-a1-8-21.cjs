/**
 * L8=apoth. L9=post. L10=resto. L11=station. L12=kapper. L13=vêtements. L14=geld. L15=taxi. L16=boulangerie. L17=ciné (billets). Eén les per keer.
 * Export: (L) => [ { num, listIndex, slug, l, voc, gram } ]
 */
module.exports = function build821(L) {
  /** NL-kolom: alleen vertaling; toelichting na eerste " — " → 8e veld (uitleg). */
  function splitNlNote(b) {
    if (typeof b !== "string" || !b.includes(" — ")) return [b, ""];
    const i = b.indexOf(" — ");
    return [b.slice(0, i).trim(), b.slice(i + 3).trim()];
  }
  const z = (a, b) => {
    const [nl, note] = splitNlNote(b);
    return L([a, nl, "", "", "", "", "", note, ""]);
  };
  const ins = (a, b, t) => {
    const [nl, noteB] = splitNlNote(b);
    const col7 = t && String(t).trim() ? t : [t, noteB].filter(Boolean).join(" — ").trim();
    return L([a, nl, "", "", "", "", "", col7, ""]);
  };
  return [
    {
      num: 8,
      listIndex: 7,
      slug: "pharmacie",
      l: [
        ins(
          "Bonjour !",
          "Goedemiddag. / Goedendag. — in de apotheek.",
          "A1 — apotheek, kort en beleefd. Spreek de Franse kant, controleer met het NL."
        ),
        z(
          "J'ai mal à la tête, un médicament sans ordonnance, s'il vous plaît, c'est possible ?",
          "Hoofdpijn, (een) medicijn zonder voorschrift, alstublieft, mag (dat)?"
        ),
        z(
          "Oui, monsieur, en rayon libre, voilà, 6 euros, s'il vous plaît. Lisez la notice, s'il vous plaît.",
          "Ja, meneer, vrij verkrijgbaar, alsjeblieft, 6 euro, alstublieft. Lees de bijsluiter, alstublieft."
        ),
        z(
          "C'est d'accord, merci, bonne journée, au revoir !",
          "Prima! Dank u, fijne dag, tot ziens!"
        ),
      ],
      voc: [
        z("avoir mal à la tête", "ik heb hoofdpijn; letterlijk: pijn hebben in het hoofd (FR + lichaamsdeel)."),
        z("le médicament (m.) / la notice (f.) (emballage)", "medicijn; bijsluiter bij de verpakking."),
        z("sans ordonnance", "zonder (arts)recept; vaak: vrij verkrijgbare producten, context apotheek."),
        z("en libre (accès) (rayon libre) / voilà, merci, bonne journée, au revoir (guichet)", "Vrij toegang / vrij schap, alsjeblieft, dank, afschied, formules aan de toonbank."),
      ],
      gram: [
        z("« j’ai mal à + lichaamsdeel » — A1", "Vaste opbouw: *J’ai mal à la tête* = ik heb hoofdpijn. Andere delen: *le ventre*, *le dos*, (later) vocab."),
        z("« sans + naam » = zonder … — A1, apotheek", "*Sans ordonnance* = (zonder) voorschrift; in de winkel: *sans sucre* = zonder suiker, enz."),
        z("L’impératif poli, consigne: « lisez la notice » — aperçu, A1", "Beleefde aansporing, *Lisez* = lees! / *Lisez la notice* = lees de bijsluiter, veilig, apotheek."),
      ],
    },
    {
      num: 9,
      listIndex: 8,
      slug: "poste",
      l: [
        ins(
          "Bonjour !",
          "Goedemiddag. — aan het postloket.",
          "A1 — post: zegels, pakket, kort. Spreek de Franse kant, controleer met het NL."
        ),
        z(
          "Deux timbres pour la Belgique, s'il vous plaît, pour une lettre normale.",
          "Twee postzegels voor België, alstublieft, voor een gewone brief."
        ),
        z(
          "Bien sûr, c'est 2,40, s'il vous plaît, tenez, merci, madame !",
          "Natuurlijk, dat is 2,40, alstublieft, alsjeblieft, dank u, mevrouw!"
        ),
        z(
          "Et ce petit colis pour la France, s'il vous plaît, c'est combien, à envoyer aujourd'hui ?",
          "En dit kleine pakket naar Frankrijk, alstublieft, hoeveel kost (verzenden), vandaag te versturen?"
        ),
        z(
          "Alors, huit euros vingt, s'il vous plaît, voilà l'étiquette, au guichet là-bas, merci !",
          "Dus, 8,20, alstublieft, hier het etiket, aan het loket daar, dank u!"
        ),
        z(
          "C'est noté, merci beaucoup, bonne journée, au revoir !",
          "Duidelijk! Hartelijk dank, fijne dag, tot ziens!"
        ),
      ],
      voc: [
        z("un timbre (m.) / la Belgique / la France (pays, envoi)", "postzegel; België, Frankrijk (als bestemming, verzenden)."),
        z("une lettre (f.) (normale, recommandée — plus tard) / le colis (m.) (petit paquet)", "brief; pakket / pakje (klein)."),
        z("envoyer (v.) / à envoyer / aujourd’hui (date d’envoi)", "verzenden; te verzenden; vandaag (als verzendmoment, A1-simpel)."),
        z("le guichet (m.) / l’étiquette (f.) (colis) / colis, affranchissement (terme, plus tard)", "loket; (verzend)etiket; pakket, frankeer (later preciezer)."),
        z("c’est combien ? / c’est noté (fam. guichet) / voilà, merci, bonne journée, au revoir", "Hoeveel (kost het)?; in orde / begrepen; alsjeblieft, dank, afschied."),
      ],
      gram: [
        z("« pour + pays » = (bestemd) voor … — A1, post", "*Pour la Belgique* = voor (post naar) België; *pour la France* = naar Frankrijk."),
        z("« c’est + prix » — oral, A1, guichet", "*C’est 2,40* / *C’est 8,20* = (dat kost) … euro; zelfde patroon als winkel, trein, context."),
        z("Question simple « c’est combien ? » + réponse chiffrée — mémorisable, A1", "Vragen: *C’est combien* = hoeveel? — antwoord: *huit euros vingt* = acht (euro) twintig (cent), oral."),
      ],
    },
    {
      num: 10,
      listIndex: 9,
      slug: "au-restaurant",
      l: [
        ins(
          "Bonsoir !",
          "Goedenavond! — binnen, restaurant, place et menu, A1.",
          "A1 — aan tafel: plaats, menu, rekening. Spreek de Franse kant, controleer met het NL."
        ),
        z(
          "Excusez-moi, monsieur, une table pour deux, s'il vous plaît, près de la fenêtre, si c'est possible ?",
          "Pardon, meneer, een tafel voor twee, alstublieft, bij het raam, als dat mag?"
        ),
        z(
          "Bien sûr, suivez-moi, voilà, la carte, et le menu du jour, c'est 18 euros, s'il vous plaît, pour aujourd'hui.",
          "Natuurlijk, volg mij, alsjeblieft, de kaart, en het dagschotelmenu, 18 euro, alstublieft, voor vandaag. — (context: prijs, voorbeeld.)"
        ),
        z(
          "Merci, nous prenons le menu du jour, s'il vous plaît, et de l’eau plate pour deux, s'il vous plaît.",
          "Dank u, wij nemen het dagschotel, alstublieft, en stil water voor twee, alstublieft."
        ),
        z(
          "Très bien, j'arrive, bon appétit ! L'addition, s'il vous plaît, quand c'est prêt, merci !",
          "Prima, ik kom eraan, eet smakelijk! De rekening, alstublieft, wanneer het (kan) klaar is, dank u!"
        ),
        z(
          "C'est 42,50, s'il vous plaît, par carte, c'est d'accord, merci, bonne soirée, au revoir !",
          "Dat is 42,50, alstublieft, met (bank)kaart, in orde, dank, fijne avond, tot ziens! — (bedrag, voorbeeld.)"
        ),
        z("Merci, monsieur, à bientôt !", "Dank, meneer, tot (bij) ziens! — kort afschied, context."),
      ],
      voc: [
        z("une table pour deux / près de la fenêtre", "Een tafel voor twee; bij het raam, als het kan."),
        z("la carte (f.) / le menu du jour (m.) / l’addition (f.)", "Eetkaart; dagschotel; rekening."),
        z("l’eau (f.) plate = stil (bron)water", "Zonder koolzuur. *Gazeuse* = bruisend (later, context)."),
        z("par carte (bancaire) / bon appétit / à bientôt, au revoir (service)", "Betalen met (bank)kaart; eet smakelijk; tot ziens, afschied, context."),
      ],
      gram: [
        z("Vaste winkel/resto: *une table pour deux*, *l’addition, s’il vous plaît*", "De rekening vragen: *L’addition* = de rekening (einde maaltijd), beleefd, A1."),
        z("*Nous prenons* + gerecht of *le menu du jour*", "*Nous prenons le menu du jour* = wij nemen (kiezen) de dagschotel; *d’accord* = goed, oké, context."),
        z("*De l’eau plate* = partitief, drank", "*De l’* = wat, van, water; *eau plate* = stil water, tafel, A1, kort, context."),
      ],
    },
    {
      num: 11,
      listIndex: 10,
      slug: "station-service",
      l: [
        ins(
          "Bonjour !",
          "Goedemiddag. / Goedendag. — aan het tankstation, aan de pomp, A1.",
          "A1 — tanken: type brandstof, betalen, kort. Spreek de Franse kant, controleer met het NL."
        ),
        z(
          "Le plein en sans plomb 95, s’il vous plaît, sur cette pompe.",
          "Een volle tank, loodvrij 95, alstublieft, aan deze pomp, context.",
        ),
        z(
          "D’accord, c’est 52,40, s’il vous plaît. Vous payez en boutique ?",
          "In orde, dat is 52,40, alstublieft. Betaalt u binnen, bij de kassa? — *en boutique* = winkeltje, context, prijs, voorbeeld.",
        ),
        z(
          "Oui, par carte, s’il vous plaît, merci. Bonne route, au revoir !",
          "Ja, met (bank)kaart, alstublieft, dank u. Fijne reis, tot ziens! — afschied, route.",
        ),
      ],
      voc: [
        z("faire le plein / le plein (expr.) = vol tanken, tanken", "Vol tanken, tankbeurt; in FR vaak: *le plein* + brandstof, station."),
        z("l’essence (f.) sans plomb 95, 98 (E10 — plus tard) / le gasoil, le diesel (m.) (attention)", "Benzine loodvrij; diesel, let op: keuze, verkeerd tanken = risico, kort, A1, context, BE."),
        z("la pompe (f.) (numéro, libre) / en boutique, au guichet (station)", "Benzinepomp, vrije pomp, nummer, context; winkeltje aan station, kassa, loket."),
        z("Bonne route ! (au départ) / merci, au revoir (service) — mémorisable, A1", "Fijne reis! (bij weggaan, tankstation) — dank, afschied, context."),
      ],
      gram: [
        z("« le plein en + type » — oral, A1, station", "*Le plein en sans plomb 95* = (een) volle tank met 95, zelfde patroon als winkel, bedrag, context."),
        z("Vous + présent, question service: *vous payez en boutique ?* — A1", "Betaalt u binnen, bij de kassa?; *en boutique* = in het winkeltje (hier, tankstation, BE/FR, context)."),
        z("*Par carte* + *bonne route* (formule de politesse) — A1", "Met kaart; *bonne route* wens voor vertrek, (kort) beleefd, station, afschied."),
      ],
    },
    {
      num: 12,
      listIndex: 11,
      slug: "coiffeur",
      l: [
        ins(
          "Bonjour !",
          "Goedemiddag. — in de kapsalon, A1, korte zinnen.",
          "A1 — kapper: afspraak, kort knippen, betalen. Spreek de Franse kant, controleer met het NL."
        ),
        z(
          "J’ai rendez-vous à 15 heures, au nom de Martin, s’il vous plaît.",
          "Ik heb om 15:00 (een) afspraak, op naam van Martin, alstublieft. — (uur, voorbeeld.)",
        ),
        z(
          "Bien sûr, asseyez-vous, cinq minutes, s’il vous plaît, merci.",
          "Natuurlijk, gaat u zitten, vijf minuten, alstublieft, dank u. — wachten, kort, salon.",
        ),
        z(
          "Un peu plus court sur les côtés, s’il vous plaît, et au-dessus, un peu, merci !",
          "Een beetje korter aan de zijkanten, alstublieft, en boven ook een beetje, dank u! — wens, stijl, A1, context.",
        ),
        z(
          "C’est 28 euros, s’il vous plaît, par carte, merci, à bientôt !",
          "Dat is 28 euro, alstublieft, met (bank)kaart, dank u, tot binnenkort! — (bedrag, voorbeeld.)",
        ),
      ],
      voc: [
        z("avoir rendez-vous (à 15h, au nom de …) / le nom (m.) (sur l’agenda, oral)", "Een afspraak hebben, om … uur, op naam van …, context salon."),
        z("s’asseoir (inv.) = ga zitten, zit / asseyez-vous, je vous en prie (poli) — mémorisable, A1", "Beleefde vorm: *Asseyez-vous* = (gaat u) zitten, even wachten, kapsalon, context."),
        z("un peu plus court / sur les côtés / au-dessus (cheveux, coupe) — mémorisable, A1", "Iets korter, aan de zijkanten, boven, haar, (geen) details, fiche, kort, oraal."),
        z("le coiffeur, la coiffeuse / le salon (de coiffure) / la coupe (f.) (cheveux)", "De kapper; kapsalon; (een) knip, haar, context, service."),
      ],
      gram: [
        z("« j’ai rendez-vous à + heure » + « au nom de + nom » — A1, coiffure", "Afspraak, op naam: *J’ai rendez-vous à 15 heures* = ik heb (om) 15:00 afspraak, context."),
        z("Comparatif simple: *un peu plus court* — cheveux, côtés, A1, oral, context", "Iets korter, zelfde patroon als *plus grand* / *moins serré* (later), kapsalon, context."),
        z("L’exclamation polie, fin de consigne, « merci, à bientôt ! » (paiement) — mémorisable, A1", "Dank, tot binnenkort, na betalen, kort, salon, service, afschied."),
      ],
    },
    {
      num: 13,
      listIndex: 12,
      slug: "vetements-essayer",
      l: [
        ins(
          "Bonjour !",
          "Goedemiddag. — in de kledingwinkel, paskamer, A1, korte zinnen, u.",
          "A1 — kleding: passen, maat, kopen, betalen. Spreek de Franse kant, controleer met het NL."
        ),
        z(
          "Excusez-moi, je peux essayer cette veste, s’il vous plaît, en taille 42, si vous l’avez ?",
          "Pardon, mag ik dit vest passen, alstublieft, maat 42, als u die hebt? — winkel, paskamer, maat, voorbeeld.",
        ),
        z(
          "Bien sûr, les cabines sont là, à droite, au fond, s’il vous plaît, merci !",
          "Natuurlijk, de paskamers, zijn daar, rechts, achterin, alstublieft, dank u! — wijzen, kort, context.",
        ),
        z(
          "Ça me va, je la prends, s’il vous plaît, merci, c’est le prix affiché ?",
          "Die past (goed), ik neem hem, alstublieft, dank u, is (dat) de aangegeven prijs? — passen, kopen, winkel, context, BE.",
        ),
        z(
          "Oui, 39,99, s’il vous plaît, en boutique ou à la caisse, par carte, merci, bonne journée !",
          "Ja, 39,99, alstublieft, in de winkel of aan de kassa, met (bank)kaart, dank, fijne dag! — (bedragen, voorbeeld.)",
        ),
      ],
      voc: [
        z("essayer (v.) + vêtement / la cabine, les cabines (d’essayage) / en taille 40, 42 (oral)", "passen, kleding; paskamer, -kamers, maat, mondeling, winkel, context, BE, FR, kort, context."),
        z("cette, ce, ces + nom (démonstratifs, magasin) — aperçu, A1, mémorisable, context", "Deze, dit, (die), *Cette veste* = dit vest, korte vorm, etalage, rayon, winkel, context, fixe, context."),
        z("ça me va / ne me va pas (fam., essayage) / je (le/la) prends, j’achète, au prix affiché — oral, A1, caisse, context", "Het past (mij) / past niet; ik neem het, ik koop, prijs, op het etiket, winkel, dienst, kort, context, BE, FR, context."),
        z("en boutique, à la caisse / par carte, merci, bonne journée, au revoir (magasin) — mémorisable, A1", "In de winkel, aan de kassa; betalen, afschied, formules, dienst, winkel, context, fixe, context."),
      ],
      gram: [
        z("« je peux + inf. » = ik mag + … — A1, politesse, magasin, context", "Beleefde vraag: *Je peux essayer* = mag ik passen, *je peux* = ik mag/kan, kleding, context."),
        z("C’est + montant, à la caisse, « c’est 39,99, s’il vous plaît » — A1, oral, prix, fiche, magasin, context", "Bedrag, aan de kassa, zelfde patroon als post, frituur, cijfer, uitspraak, winkel, context, fixe, context."),
        z("Achat, oral: *je la prends* (veste, f. → la) — mémorisable, A1, genre, mémorisation, bref, context", "Ik neem hem/haar: *je la prends* (v., f.), *le/la* overeenkomen met (het) stuk, kort, aankoop, context, BE, A1, bref, context."),
      ],
    },
    {
      num: 14,
      listIndex: 13,
      slug: "distributeur-monnaie",
      l: [
        ins(
          "Bonjour !",
          "Goedemiddag. — geld, automaat, wisselgeld, A1, korte zinnen, u.",
          "A1 — geld: DAB/ automaat, wissel, kleine betaling. Spreek de Franse kant, controleer met het NL."
        ),
        z(
          "Excusez-moi, le distributeur automatique, c’est près d’ici, s’il vous plaît ?",
          "Pardon, de (geld)automaat, is (die) hier in de buurt, alstublieft? — lokaliseren, kort, context.",
        ),
        z(
          "Oui, monsieur, c’est en face, à côté de la boulangerie, s’il vous plaît, merci !",
          "Ja, meneer, recht (tegen)over, naast de bakker, alstublieft, dank u! — wijzen, straat, context.",
        ),
        z(
          "Bonjour, c’est 4,20, s’il vous plaît. Tenez, voici 20, la monnaie, s’il vous plaît, merci !",
          "Dag, dat is 4,20, alstublieft. Alsjeblieft, (hier) 20, het wisselgeld, alstublieft, dank u! — winkel, kassa, klein bedrag, context.",
        ),
        z(
          "Bien sûr, c’est 15,80, tenez, voilà, merci, madame, bonne journée, au revoir !",
          "Natuurlijk, dat is 15,80, neem, alsjeblieft, dank, mevrouw, fijne dag, tot ziens! — wissel, bedrag, voorbeeld, context, BE.",
        ),
      ],
      voc: [
        z("le distributeur (automatique) (DAB) / retirer (v.) = geld opnemen, plus tard: code, carte — aperçu, A1, banque, context", "Geldautomaat, (te) pinnen, later in detail; automaat, bank, context, kort, context."),
        z("c’est / il est + près d’ici, en face, à côté de (lieu) — mémorisable, A1, rue, context", "Hier dichtbij, recht (tegen)over, naast (de bakker), wijzen, reis, winkel, context, fixe, context."),
        z("la monnaie (f.) = wisselgeld, kleingeld / un billet (5, 10, 20 €) / (une) pièce, des pièces (attention) — mémorisable, A1, caisse, context", "Wisselgeld; (bank)biljet, muntstukken, passend op, korte betaling, winkel, context, BE, FR, context."),
        z("Tenez! Voilà! (remise, argent) / merci, bonne journée, au revoir (kassa) — mémorisable, A1", "Neem! Alsjeblieft! — geld, kassa, afschied, formule, winkel, context, fixe, context."),
      ],
      gram: [
        z(" « Où est… ? » / « c’est près d’ici (?) » = waar / hier dichtbij — A1, localisation, DAB, context", "Waar, DAB, *c’est près d’ici* = hier dichtbij, zelfde patroon als winkel, straat, context."),
        z("Achat, oral: *Tenez, voici 20, la monnaie* — wissel, billets, mémorisable, A1, caisse, context", "Alsjeblieft, hier 20, het wisselgeld (terug); *la monnaie* = wisselgeld na betalen, winkel, kort, context, BE, FR, bref, context."),
        z("C’est 15,80 = total rendu, oral — mémorisable, A1, argent, chiffre, fiche, context, fixe, context", "Resterend, terug, bedrag, mondeling, cijfer, winkel, afronding, korte zin, context, BE, bref, context."),
      ],
    },
    {
      num: 15,
      listIndex: 14,
      slug: "taxi-court",
      l: [
        ins(
          "Bonjour !",
          "Goedemiddag. / Goedenavond. — in de taxi, korte rit, A1, u.",
          "A1 — taxi: bestemming, prijs, betalen. Spreek de Franse kant, controleer met het NL."
        ),
        z(
          "Bonjour, à la gare, s’il vous plaît, c’est proche, une course simple.",
          "Goedemiddag, naar het station, alstublieft, (het) is dichtbij, een (gewone) rit, A1, context, BE.",
        ),
        z(
          "Bien sûr, montez, s’il vous plaît, cinq minutes, ceinture, merci, on y va !",
          "Natuurlijk, stapt u in, alstublieft, (ongeveer) vijf minuten, gordel, dank u, we gaan! — chauffeur, kort, veilig, context, BE.",
        ),
        z(
          "C’est combien, à peu près, s’il vous plaît, pour aujourd’hui ?",
          "Hoeveel (kost dat) ongeveer, alstublieft, voor (vandaag, deze rit)? — prijs, vraag, context.",
        ),
        z(
          "Alors, douze euros, s’il vous plaît, en espèces ou par carte, comme vous voulez, merci !",
          "Dus, twaalf euro, alstublieft, contant of met (bank)kaart, wat u (wil), dank u! — (bedrag, voorbeeld.)",
        ),
        z(
          "Par carte, s’il vous plaît, merci, monsieur, bonne soirée, au revoir !",
          "Met (bank)kaart, alstublieft, dank, meneer, fijne avond, tot ziens! — afschied, taxichauffeur, context.",
        ),
      ],
      voc: [
        z("le taxi, le taximètre (rare, oral) / le chauffeur, la course (f.) (simple) — mémorisable, A1, rue, context, BE, kort, context", "Taxi, taximeter, soms, mondeling; bestuurder, (een) rit, kort, straat, context, BE, bref, context."),
        z("à la gare, au centre, à l’adresse (c.-à-d. le lieu) / proche, loin, cinq minutes (oral) — mémorisable, A1, trajet, context, fixe, context", "Naar (het) station, (naar) centrum, naar het adres, kort, reis, wijzen, context, BE, bref, context."),
        z("c’est combien (course) / en espèces, par carte, comme vous voulez (paiement) — mémorisable, A1, caisse, context, BE", "Hoeveel, voor de rit, contant, met (bank)kaart, (zoals) u wilt, betalen, taxichauffeur, context, BE."),
        z("monter, montez (imp.) (poli) / la ceinture, attachez (sécurité) — aperçu, A1, voiture, context, BE", "Instappen, *Montez* = stapt u in, gordel, vast, veilig, kort, context, BE."),
      ],
      gram: [
        z("Destination: *à + lieu* (gare, centre, adresse) — A1, taxi, oral", "Naar (het) station, *à la gare*; *au centre* = naar het centrum; vaste voorzetselkeuze, context."),
        z("« c’est combien ? » + réponse *… euros* (course) — mémorisable, A1", "Hoeveel? — *Douze euros* = twaalf euro, zelfde als winkel, post, taxichauffeur, context."),
        z("Paiement: *en espèces ou par carte* / *comme vous voulez* — poli, A1, taxi", "Contant of met (bank)kaart; *comme vous voulez* = zoals u wilt, kort, betalen, context."),
      ],
    },
    {
      num: 16,
      listIndex: 15,
      slug: "boulangerie",
      l: [
        ins(
          "Bonjour !",
          "Goedemorgen. / Goedemiddag. — in de bakkerij, A1, korte aankoop, u.",
          "A1 — bakker: bestellen, prijs, betalen. Spreek de Franse kant, controleer met het NL."
        ),
        z(
          "Je voudrais une baguette, s’il vous plaît, et deux croissants, c’est possible ?",
          "Ik wil graag (een) stokbrood, alstublieft, en twee croissants, is dat (mogelijk)? — *Je voudrais* = beleefd bestellen, bakker.",
        ),
        z(
          "Bien sûr, madame, c’est 3,20, s’il vous plaît, tenez, voilà, merci !",
          "Natuurlijk, mevrouw, dat is 3,20, alstublieft, neem, alsjeblieft, dank u! — toonbank, (bedrag, voorbeeld.)",
        ),
        z(
          "Avez-vous du pain complet, aujourd’hui, s’il vous plaît, une petite miche ?",
          "Heeft u (vandaag) volkorenbrood, alstublieft, een (klein) rond (brood)? — *Avez-vous* = heeft u, aanbod, bakker.",
        ),
        z(
          "Oui, voilà, 2,80, s’il vous plaît, la miche, merci, bonne journée, au revoir !",
          "Ja, alsjeblieft, 2,80, alstublieft, het (ronde) brood, dank, fijne dag, tot ziens! — tweede aankoop, prijs, voorbeeld.",
        ),
      ],
      voc: [
        z("la boulangerie / le boulanger, la boulangère / le comptoir (vente)", "Bakkerij; bakker(ster); toonbank, A1, context."),
        z("une baguette, un croissant, du pain, une miche, du pain complet", "Stokbrood, croissant, brood, rond (brood), volkorenbrood, A1, context."),
        z("Tenez! Voilà! (comptoir) / c’est 3,20 (prix) / bonne journée, au revoir (sortie)", "Neem! Alsjeblieft! — bedrag, mondeling, afschied, winkel, context."),
        z("Avez-vous… ? aujourd’hui (disponibilité) — mémorisable, A1, oral", "Heeft u (vandaag) …? — vraag om aanbod, kort, context."),
      ],
      gram: [
        z("Politesse, achat: *je voudrais* + nom, *s’il vous plaît* — A1, boulangerie", "Beleefd bestellen: *Je voudrais une baguette* = ik wil graag (een) stokbrood, winkel, context."),
        z("Partitif: *du pain (complet)*, *un peu de…* (aperçu) — mémorisable, A1, aliment, context", "Onbep. hoeveelheid: *du pain* = (wat) brood, *complet* = volkoren, bakker, context."),
        z("Vente, réponse: *c’est 3,20, tenez, voilà* — mémorisable, A1, comptoir, context", "Bedrag, overhandigen: zelfde patroon als frituur, post, winkel, context, BE, context."),
      ],
    },
    {
      num: 17,
      listIndex: 16,
      slug: "cinema-billets",
      l: [
        ins(
          "Bonsoir !",
          "Goedenavond! — in de buurt van de cinema, kaartje, A1, u.",
          "A1 — film, plaatsen, voorstelling, betalen. Spreek de Franse kant, controleer met het NL."
        ),
        z(
          "Deux places pour le film, s’il vous plaît, la séance de 20 heures, c’est possible ?",
          "Twee (kaartjes) voor de film, alstublieft, de voorstelling om 20:00, is dat (mogelijk)? — billeterie, kort, context.",
        ),
        z(
          "Bien sûr, 18 euros en tout, s’il vous plaît, salle 3, tenez, voilà vos billets, bon film !",
          "Natuurlijk, 18 euro in totaal, alstublieft, zaal 3, neem, alsjeblieft uw kaartjes, fijne film! — (bedrag, voorbeeld.)",
        ),
        z(
          "Par carte, s’il vous plaît, merci, bonne soirée, au revoir !",
          "Met (bank)kaart, alstublieft, dank, fijne avond, tot ziens! — afschied, guichet, context.",
        ),
      ],
      voc: [
        z("le cinéma, la salle (numéro), la séance (horaire) / une place, deux places (billets)", "Bioscoop, (zaal)nummer, voorstelling; plaats, twee kaartjes, A1, context."),
        z("pour le film / à 20 heures, de 20 heures (affiche, oral) / bon film ! (accueil)", "Voor de film; om 20 uur; fijne film! — personeel, kort, context."),
        z("18 euros en tout (prix) / tenez, voilà vos billets (remise) / par carte (paiement)", "Totaalprijs; hier uw kaartjes; met (bank)kaart, context."),
        z("merci, bonne soirée, au revoir (sortie cinéma) — mémorisable, A1", "Dank, fijne avond, tot ziens, afschied, context."),
      ],
      gram: [
        z("« deux places pour + le film » — A1, billetterie, oral", "Twee plaatsen voor de film; *pour* = voor, cultuur, context."),
        z("« la séance de 20 heures » = de (voorstelling om) 20:00 — mémorisable, A1", "Uur aangeven, scherm, zelfde idee als reserveren restaurant, context."),
        z("« en tout » + prix, « par carte » — A1, paiement, cinéma", "In totaal; met (bank)kaart, betalen, guichet, context."),
      ],
    },
  ];
};
