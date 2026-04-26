/**
 * Lessen 6–21: volgen de 20-lijst (lessons-a1-everyday header), voor situaties
 * 4, 6, 7, …, 20 (1–3 en 5 = les 2–5 al aanwezig).
 * Export: (L) => array van { num, listIndex, slug, l, voc, gram }
 */
module.exports = function buildA1Situaties(L) {
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
      num: 6,
      listIndex: 4,
      slug: "friterie-ou-afhaal",
      l: [
        ins(
          "Bonjour !",
          "Goedendag! / Goedenavond! — frituur of afhaal, korte zinnen, A1.",
          "A1 — frituur / afhaal. Spreek de Franse kant, controleer met het NL."
        ),
        z("Bonsoir, madame, une barquette de frites, s'il vous plaît !", "Goedeavond, mevrouw, een (bakje) frites, alstublieft! — *barquette* = (klein) bakje, vaak, frituur, BE/FR."),
        z("Avec de la sauce mayonnaise, s'il vous plaît, et un peu de ketchup, si vous avez. ", "Met mayonaise, alstublieft, en wat ketchup, als u (dat) hebt, mag het erbij!"),
        z("Bien sûr ! C'est 5,50, s'il vous plaît, au comptoir, voilà !", "Natuurlijk! Dat is vijf (euro) vijftig, alstublieft, aan de toonbank, alstublieft (ter hand)!"),
        z("C'est noté, merci, madame, bonne soirée !", "Duidelijk, dank u, mevrouw, fijne avond! (— *C’est noté* = in orde / begrepen, informeel)"),
        z("Merci beaucoup, au revoir !", "Hartelijk dank, tot ziens! — kort afsluiten, winkel, dienst."),
        z("Au revoir, bonne soirée !", "Tot ziens, fijne avond! — formule, wederkerig, afschied, eten, meenemen."),
      ],
      voc: [
        z("une barquette (f.) (de frites) / une portion (f.)", "een bakje (frites), een (normale) portie — frituur, kort, oraal; *portion* = portie, context."),
        z("les frites (f. pl.) (Belgique) / des pommes frites/…", "friet — in het NL *frieten*; in het FR, courant, *frites* en Belgique, surtout, friterie, rapide, context."),
        z("la sauce (f.) (mayonnaise, ketchup, …) / le ketchup (m. inv.)", "saus, mayonaise, ketchup — in het echt, bijkiesen, tafel, frituur, vaste r uitroep, context."),
        z("le comptoir (m.)", "de toonbank, balie; *au comptoir* = aan de toonbank, *commander* = bestellen, context."),
        z("C'est 5,50 (oral, prix) / voilà (remise) / c'est noté (fam. magasin)", "Prijse (vijf, vijftig) — in het echt, chiffre, afronding, context; *voilà* = alsjeblieft; *C’est noté* = duidelijk, binnen, dienst, eenvoud, context, BE."),
        z("Bonne soirée ! / au revoir ! (afsluit, afhaal)", "Fijne avond! Tot ziens! — vaste, formules, afschied, frituur, meenemen."),
      ],
      gram: [
        z("« Avec de la + nom » = met (wat) … (quantité) — aperçu, A1", "Structuur, frites, *avec de la mayonnaise* = met mayonaise; *un peu de* = een beetje, (plus tard) quantité, context."),
        z("Prix, oral, simple, en euros, « c’est 5,50 » — A1", "In het echt, *cinq euros cinquante* / *5,50* (écrit) — mélange, nombres, autre, fiche, nombres, 1–20, 100, recommand, fort, ici, comprénsion, seule, context."),
        z("Comptoir, friterie, commande, impératif, poli, *s'il vous plaît* — mémorisable", "Beleefd, kort, friteur, *Une barquette, s'il vous plaît!* = een bakje, alstublieft, context."),
      ],
    },
    {
      num: 7,
      listIndex: 6,
      slug: "transport-commun",
      l: [
        ins("Bonjour !", "Goedemorgen! / Goedendag! / Hallo! — reizen, in station.", "A1 — openbaar vervoer, ticket, informatie, guichet, korte zinnen, u."),
        z("Excusez-moi, s'il vous plaît, un ticket, direction centre-ville, c'est ici, la ligne B ?", "Pardon, alstublieft, (een) ticket, richting centrum, is het hier, lijn B? — kort, guichet, halte, context."),
        z("Oui, monsieur, le guichet est là, devant, à gauche, pour les tickets, s'il vous plaît.", "Ja, meneer, (het) loket, is daar, ervóór, (aan de) linkerkant, (voor) tickets, alstublieft. — in het echt, plan, salle, context."),
        z("Un aller simple, s'il vous plaît, 2e classe, pour aujourd'hui, c'est possible ?", "Een enkele reis, alstublieft, tweede klas, voor (vandaag), mag (dat)? (— 2e = *deuxième*, context trein)"),
        z("Bien sûr, 2 euros 20, s'il vous plaît, tenez, votre ticket, merci, bonne journée !", "Natuurlijk, 2,20, alstublieft, neem, uw ticket, dank, fijne dag! — formules, billeterie, context."),
        z("Merci, madame, au revoir !", "Dank u, mevrouw, tot ziens! — kort, formeel, salle, context."),
        z("Au revoir, et bonne route ! (humour doux) / bon voyage, si c’est loin, non ? (joke, soft, option)", "Tot ziens, en fijne reis! / goede reis! — wederkerig, afschied, context."),
      ],
      voc: [
        z("un ticket (m.) (aller simple / A/R) / 2e classe (loc.) / aller (m., sens du trajet) / retour (m.) (retour) / la ligne (f.) (B, tram, M…)", "ticket, (enkele) reis, (heen) en terug, (trein)lijn, tweede klas — mots, transport, salle, context."),
        z("le guichet (m.) / l’agence, le point, « vente, tickets » (panneau) / la salle, le hall, quai (f., plus tard) / le quai (m.) (plus tard) / la gare, la station, le bus, le tram, le M (fam.) (m.)", "loket, (hal)zaal, perron, (later) — A1, guichet, salle, context."),
        z("c’est ici, c’est par là, à gauche, devant, « direction … » (panneau) / c’est ici, la (ligne) B ?", "Hier, daarheen, links, ervóór, richting … — wijzen, context."),
        z("2e classe, pour aujourd’hui, c’est possible ?", "tweede klas, vandaag, mag (dat) — billeterie, context, context."),
        z("Tenez! Votre ticket! (remise, guichet) / Bonne journée! / Au revoir! / Bonne route! (informeel, reiziger)", "Neem! Uw treinkaart! / Fijne dag! / Tot ziens! / (fijne) reis! — korte, formules, guichet, afschied, context, BE/FR."),
      ],
      gram: [
        z(" « Un aller simple » = een enkele reis (billeterie) — formule, A1, fixe, transport", "Vaste, termen, billeterie, parfois, *aller-retour* = (heen) en terug, context."),
        z(" « Direction + lieu » = richting (centrum) — panneau, oral, A1, transport", "Op borden, *Direction centre* = (naar) richting centrum; *Ligne B* = lijn B, context."),
        z("Prix, tickets, 2,20, oral — chiffre, virgule, A1, rappel, court, transport, context", "Zelfde, logica, *deux*, *virgule*, *20*, côté, oral, salle, context, voir, nombres, fiche, separée, ici, ok, A1, fixe, context."),
      ],
    },
  ];
};
