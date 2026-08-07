// ─────────────────────────────────────────────────────────────────────────────
// Banco de contenido — Módulo DELF B1 (nouveau format, 100% preguntas cerradas)
// Compréhension écrite: 45 min, 25 pts, 3 ejercicios (annonces + 2 articles).
// Production écrite: 45 min, 25 pts, texto de opinión ~160 palabras mínimo.
// Contenido del examen en francés; interfaz en español.
// ─────────────────────────────────────────────────────────────────────────────

const DELF_TEST_B1_1 = {
    id: 'delf-b1-practice-1',
    name: 'Práctica DELF B1 — completa 1',
    level: 'B1',

    ce: {
        minutes: 45,
        totalPoints: 25,
        tasks: [
            {
                type: 'mc',
                title: 'Exercice 1 — Lire pour s’orienter',
                instructions: 'Lisez la situation et les quatre annonces, puis répondez aux questions (Oui / Non ou choix multiple).',
                textLabel: 'Situation + annonces',
                text: 'SITUATION : Vous habitez à Lyon et vous cherchez une activité sportive pour l’année. Vos critères : moins de 40 € par mois, des séances le soir après 18 h, un niveau débutant accepté, et un lieu accessible en métro.\n\nANNONCE A — Club Aquatique du Rhône\nNatation pour tous les niveaux, du lundi au vendredi de 12 h à 14 h. 35 € par mois. À 5 minutes de la station de métro Guillotière. Essai gratuit.\n\nANNONCE B — Studio Yoga Lumière\nCours de yoga débutants et intermédiaires, mardi et jeudi de 19 h à 20 h 30. 38 € par mois, tapis fournis. Station de métro Bellecour à 2 minutes.\n\nANNONCE C — Escalade Vertige\nSalle d’escalade ouverte tous les soirs de 18 h à 22 h. Débutants bienvenus, moniteur diplômé. 55 € par mois, matériel inclus. Accès uniquement en bus (ligne 27).\n\nANNONCE D — Course à pied « Les Foulées »\nGroupe de course pour coureurs confirmés, sorties samedi matin à 7 h. Gratuit, inscription obligatoire. Rendez-vous au parc de la Tête d’Or (métro Masséna).',
                questions: [
                    { q: 'L’annonce A propose des séances le soir.', options: ['Oui', 'Non'], answer: 1 },
                    { q: 'L’annonce A respecte le budget maximum.', options: ['Oui', 'Non'], answer: 0 },
                    { q: 'L’annonce B accepte les débutants.', options: ['Oui', 'Non'], answer: 0 },
                    { q: 'L’annonce B propose des séances après 18 h.', options: ['Oui', 'Non'], answer: 0 },
                    { q: 'L’annonce C est accessible en métro.', options: ['Oui', 'Non'], answer: 1 },
                    { q: 'L’annonce C respecte le budget maximum.', options: ['Oui', 'Non'], answer: 1 },
                    { q: 'L’annonce D est réservée aux sportifs expérimentés.', options: ['Oui', 'Non'], answer: 0 },
                    { q: 'L’annonce D propose une activité gratuite.', options: ['Oui', 'Non'], answer: 0 },
                    { q: 'Quelle annonce correspond à TOUS les critères de la situation ?', options: ['Annonce A', 'Annonce B', 'Annonce C', 'Annonce D'], answer: 1 },
                    { q: 'Quel critère l’annonce C ne respecte-t-elle PAS, en plus du prix ?', options: ['Le niveau débutant', 'L’horaire du soir', 'L’accès en métro'], answer: 2 }
                ]
            },
            {
                type: 'mc',
                title: 'Exercice 2 — Lire la presse (article 1)',
                instructions: 'Lisez l’article, puis répondez aux questions en choisissant la bonne réponse.',
                textLabel: 'Article de presse',
                text: 'Les bibliothèques de rue, une idée qui fait son chemin\n\nDepuis quelques années, de petites boîtes remplies de livres apparaissent sur les places et dans les parcs des villes françaises. Le principe est simple : chacun peut prendre un livre gratuitement, à condition d’en déposer un autre en échange. Nées aux États-Unis, ces « bibliothèques de rue » se comptent aujourd’hui par milliers en France.\n\nLeur succès s’explique d’abord par la gratuité, mais pas seulement. « Les gens redécouvrent le plaisir de partager », explique Camille Rousseau, qui a installé une boîte à livres devant son immeuble à Nantes. « Des voisins qui ne se parlaient jamais discutent maintenant de leurs lectures. » Les mairies encouragent le mouvement : certaines fournissent les boîtes, d’autres organisent des ateliers de fabrication avec des matériaux recyclés.\n\nTout n’est pas parfait, cependant. Certaines boîtes sont parfois vidées entièrement par des personnes qui revendent les livres, et d’autres reçoivent des ouvrages en très mauvais état. Pour éviter ces problèmes, des associations proposent qu’un « parrain » s’occupe de chaque boîte : il vérifie régulièrement son contenu et retire les livres abîmés.\n\nMalgré ces difficultés, le mouvement continue de grandir. La ville de Toulouse, par exemple, a annoncé l’installation de cinquante nouvelles boîtes avant la fin de l’année, principalement dans les quartiers éloignés du centre, où les habitants ont moins accès aux bibliothèques municipales.',
                questions: [
                    { q: 'Cet article parle principalement…', options: ['du succès et des limites des bibliothèques de rue', 'de la fermeture des bibliothèques municipales', 'du prix des livres en France'], answer: 0 },
                    { q: 'Pour prendre un livre dans une bibliothèque de rue, il faut…', options: ['payer une petite somme', 'laisser un autre livre', 's’inscrire à la mairie'], answer: 1 },
                    { q: 'Ce concept est né…', options: ['en France', 'aux États-Unis', 'à Toulouse'], answer: 1 },
                    { q: 'Selon Camille Rousseau, les boîtes à livres…', options: ['créent des liens entre voisins', 'font baisser le prix des livres', 'remplacent les librairies'], answer: 0 },
                    { q: 'Certaines mairies aident le mouvement en…', options: ['payant les lecteurs', 'fournissant des boîtes', 'achetant des livres neufs'], answer: 1 },
                    { q: 'Quel problème est mentionné dans l’article ?', options: ['Des personnes revendent les livres', 'Les boîtes coûtent trop cher', 'Les habitants ne lisent plus'], answer: 0 },
                    { q: 'Toulouse va installer ses nouvelles boîtes surtout…', options: ['dans le centre-ville', 'dans les quartiers éloignés du centre', 'dans les écoles'], answer: 1 }
                ]
            },
            {
                type: 'mc',
                title: 'Exercice 3 — Lire la presse (article 2)',
                instructions: 'Lisez l’article, puis répondez aux questions en choisissant la bonne réponse.',
                textLabel: 'Article de presse',
                text: 'Manger local : un choix qui change tout ?\n\nAcheter ses légumes chez le producteur du village plutôt qu’au supermarché : de plus en plus de Français font ce choix. Selon une enquête récente, près d’un consommateur sur deux déclare acheter régulièrement des produits locaux, contre un sur quatre il y a dix ans.\n\nLes raisons de ce changement sont variées. Beaucoup veulent d’abord soutenir les agriculteurs de leur région, qui reçoivent une part plus importante du prix quand ils vendent directement. D’autres recherchent des produits plus frais : un légume cueilli le matin et vendu l’après-midi n’a pas voyagé pendant des jours dans un camion. L’argument écologique compte aussi, même s’il est plus compliqué qu’il n’y paraît : un produit local cultivé sous une serre chauffée peut consommer plus d’énergie qu’un produit importé de saison.\n\nLe principal obstacle reste le prix. Les produits locaux sont souvent plus chers que ceux des grandes surfaces, et tout le monde ne peut pas se le permettre. Les marchés de producteurs ont aussi des horaires limités, peu pratiques pour les personnes qui travaillent.\n\nPour répondre à ces difficultés, des solutions apparaissent. Des applications mettent en relation directe producteurs et consommateurs, avec des points de retrait ouverts le soir. Certaines cantines scolaires s’engagent également à servir une part minimum de produits régionaux, ce qui garantit aux agriculteurs des ventes régulières et fait découvrir les produits locaux aux enfants.',
                questions: [
                    { q: 'Quelle est l’idée principale de l’article ?', options: ['Les Français achètent de plus en plus local, malgré des obstacles', 'Les supermarchés vont bientôt disparaître', 'Les produits importés sont dangereux'], answer: 0 },
                    { q: 'Aujourd’hui, combien de consommateurs achètent régulièrement local ?', options: ['Environ un sur quatre', 'Environ un sur deux', 'La quasi-totalité'], answer: 1 },
                    { q: 'Quand ils vendent directement, les agriculteurs…', options: ['gagnent une part plus importante du prix', 'paient plus de taxes', 'vendent moins de produits'], answer: 0 },
                    { q: 'Selon l’article, l’argument écologique est…', options: ['toujours vrai', 'plus compliqué qu’il n’y paraît', 'complètement faux'], answer: 1 },
                    { q: 'Un produit local peut consommer plus d’énergie s’il est…', options: ['transporté en camion', 'cultivé sous une serre chauffée', 'vendu au marché'], answer: 1 },
                    { q: 'Quel est le principal obstacle mentionné ?', options: ['Le prix', 'Le goût', 'Le manque de choix'], answer: 0 },
                    { q: 'Les nouvelles applications proposent…', options: ['des recettes de cuisine', 'des points de retrait ouverts le soir', 'des livraisons gratuites'], answer: 1 },
                    { q: 'L’engagement des cantines scolaires permet…', options: ['de baisser les impôts locaux', 'des ventes régulières pour les agriculteurs', 'de supprimer les supermarchés'], answer: 1 }
                ]
            }
        ]
    },

    // ── Compréhension de l'oral ──────────────────────────────────────────────
    // TRANSCRIPTS Y PREGUNTAS SON DE ELABORACIÓN PROPIA (2026-08-02). Antes eran
    // los literales del sujet démo B1TP_02; se reemplazaron porque Sinapsis se
    // vende a colegios y republicar el sujet oficial en un producto de pago no es
    // lo mismo que descargarlo para practicar. Del examen real se replica lo que
    // es estructura, no contenido:
    //   · 3 documentos de dificultad creciente: diálogo cotidiano → radio sobre
    //     un tema profesional/educativo → radio sobre un tema de sociedad.
    //   · 7 + 9 + 9 = 25 puntos, 19 ítems, 100% QCM (nouveau format).
    //   · Puntuación NO uniforme dentro de cada ejercicio: conviven ítems de 1 y
    //     de 1,5 puntos, como en el baremo oficial.
    //   · Longitud calibrada contra el sujet (324-388 palabras por documento,
    //     ~2 min a 150 wpm) y por debajo del tope de 2000 caracteres del endpoint
    //     de diálogo de ElevenLabs, para que cada clip salga de UNA sola tirada.
    //
    // Los mismos textos están en `admin-audio.js` (ESTILOS[...].referencia): es
    // lo que carga el botón del estudio de audio, y por eso el examen encuentra
    // su clip solo, emparejado por transcript. Si se edita un transcript aquí,
    // hay que editarlo allí — si no, el documento se queda sin audio.
    co: {
        totalPoints: 25,
        // Pausas del nouveau format, medidas en la pista del surveillant. Son la
        // estructura real de la épreuve; el reproductor las respeta pero deja
        // saltarlas (decisión de Juan: practicar no es examinarse).
        pausas: { leer: 60, entreEscuchas: 10, responder: 30 },
        documents: [
            {
                id: 'co1',
                clipTipo: 'delf-dialogo',
                title: 'Exercice 1 — Conversation',
                consigne: 'Vous écoutez une conversation entre deux amis.',
                points: 7,
                maxPlays: 2,
                transcript: `Sophie: Karim ! Tu tombes bien, j'allais justement t'appeler.
Karim: Ah bon ? Il y a un problème ?
Sophie: Au contraire ! Ça y est, j'ai signé : je déménage à Nantes le mois prochain.
Karim: À Nantes ? Mais c'est loin ! Et ton travail ici, alors ?
Sophie: Justement, c'est pour le travail. On m'a proposé un poste de responsable dans une agence là-bas. J'ai longtemps hésité à cause de la distance, mais l'appartement est beaucoup plus grand et le loyer est presque le même qu'ici.
Karim: Alors là, bravo ! Et tu pars quand, exactement ?
Sophie: Le samedi 12. Et c'est un peu pour ça que je voulais te parler... Tu serais libre ce week-end-là ?
Karim: Pour porter des cartons, tu veux dire ?
Sophie: Voilà. J'ai déjà réservé une camionnette, mais toute seule, je n'y arriverai jamais.
Karim: Le samedi matin, j'accompagne mon fils au football, mais je peux passer à partir de midi. Ça t'irait ?
Sophie: Parfait ! De toute façon, le matin, je dois encore vider la cave.
Karim: Et les meubles ? Tu emportes tout ?
Sophie: Non, je laisse le canapé et la vieille armoire. Je préfère les donner à une association plutôt que de les jeter.
Karim: Tu as raison, ils serviront à quelqu'un. Et pour le déjeuner, ne t'inquiète pas : je passe à la boulangerie avant de venir.
Sophie: C'est gentil, merci ! Ah, et j'allais oublier le plus important : est-ce que tu pourrais garder le chat une semaine, le temps que je m'installe ?
Karim: Sans problème, les enfants vont être ravis. Mais à une condition : tu nous invites à Nantes cet été !
Sophie: Ça, c'est promis. Et je vous ferai visiter, il paraît que la mer est à moins d'une heure.`,
                questions: [
                    { q: 'Sophie annonce à Karim qu’elle va…', options: ['changer d’appartement dans la même ville', 'déménager à Nantes', 'partir en vacances au bord de la mer'], answer: 1, points: 1 },
                    { q: 'Quelle est la raison principale de ce changement ?', options: ['Un nouveau poste de responsable', 'Un loyer beaucoup moins cher', 'Se rapprocher de sa famille'], answer: 0, points: 1 },
                    { q: 'Qu’est-ce que Sophie a déjà fait ?', options: ['Elle a réservé une camionnette', 'Elle a vidé la cave', 'Elle a vendu ses meubles'], answer: 0, points: 1 },
                    { q: 'Pourquoi Karim ne peut-il pas venir le samedi matin ?', options: ['Parce qu’il travaille', 'Parce qu’il accompagne son fils au football', 'Parce qu’il doit aller à la boulangerie'], answer: 1, points: 1.5 },
                    { q: 'Que va faire Sophie du canapé et de l’armoire ?', options: ['Les emporter à Nantes', 'Les jeter', 'Les donner à une association'], answer: 2, points: 1.5 },
                    { q: 'Qu’est-ce que Karim demande en échange de son aide ?', options: ['Être invité à Nantes cet été', 'Garder la camionnette un jour de plus', 'Récupérer la vieille armoire'], answer: 0, points: 1 }
                ]
            },
            {
                id: 'co2',
                clipTipo: 'delf-radio-pro',
                title: 'Exercice 2 — Émission de radio',
                consigne: 'Vous écoutez la radio. Il s’agit d’une interview sur l’orientation des jeunes.',
                points: 9,
                maxPlays: 2,
                transcript: `Journaliste: Chaque année, des milliers de collégiens doivent choisir une orientation sans avoir jamais vu de près le métier qui les attire. L'association Un métier, une journée leur propose de passer une journée entière avec un professionnel. Je reçois sa coordinatrice, Claire Berthier. Bonjour Claire. Comment est née cette idée ?
Claire: Bonjour. Elle est née d'un constat très simple. En troisième, les élèves font un stage d'observation d'une semaine ; mais la plupart le font chez un parent ou chez un voisin, parce qu'ils n'ont pas d'autre contact. Résultat : ils découvrent toujours les mêmes métiers, ceux de leur famille.
Journaliste: Et concrètement, comment se passe cette journée ?
Claire: L'élève suit un professionnel qui a accepté de l'accueillir : une vétérinaire, un architecte, une cuisinière... Il ne visite pas, il l'accompagne du matin au soir, il assiste aux réunions, il pose ses questions. C'est très différent d'une visite d'entreprise en groupe, où l'on regarde tout de loin.
Journaliste: Combien de professionnels participent aujourd'hui ?
Claire: Un peu plus de trois cents dans la région, et l'année dernière, mille deux cents élèves ont fait leur journée. Ce qui nous manque, ce ne sont pas les jeunes : ce sont les métiers manuels, où il y a pourtant énormément de travail.
Journaliste: Et si un professionnel nous écoute et veut participer ?
Claire: La première étape, c'est de remplir le formulaire sur notre site. Ensuite, nous l'appelons : un entretien d'une vingtaine de minutes, pour préparer la journée ensemble. Et c'est lui qui choisit ses dates.
Journaliste: Un dernier mot ?
Claire: Ce qui me frappe le plus, c'est qu'un élève sur trois change d'avis après sa journée. Parfois il abandonne une idée qu'il avait depuis des années, parfois il découvre un métier dont il ignorait l'existence. Dans les deux cas, il choisit en connaissance de cause.`,
                questions: [
                    { q: 'Que propose l’association aux élèves ?', options: ['Une journée complète auprès d’un professionnel', 'Des cours du soir pour préparer l’orientation', 'Une visite d’entreprise en groupe'], answer: 0, points: 1.5 },
                    { q: 'Selon Claire, quel est le problème des stages de troisième ?', options: ['Ils durent trop peu de temps', 'Les élèves les font chez un parent ou un voisin', 'Les entreprises refusent d’accueillir les élèves'], answer: 1, points: 1.5 },
                    { q: 'Pendant la journée, l’élève…', options: ['observe l’entreprise de loin', 'accompagne le professionnel du matin au soir', 'travaille à la place du professionnel'], answer: 1, points: 1.5 },
                    { q: 'Combien d’élèves ont participé l’année dernière ?', options: ['Trois cents', 'Mille deux cents', 'Une vingtaine'], answer: 1, points: 1.5 },
                    { q: 'Qu’est-ce qui manque le plus à l’association ?', options: ['Des jeunes intéressés', 'Des professionnels des métiers manuels', 'De l’argent pour les transports'], answer: 1, points: 1.5 },
                    { q: 'Après leur journée, un élève sur trois…', options: ['change d’avis sur son orientation', 'demande à revenir une deuxième fois', 'abandonne ses études'], answer: 0, points: 1.5 }
                ]
            },
            {
                id: 'co3',
                clipTipo: 'delf-radio-soc',
                title: 'Exercice 3 — Émission de radio',
                consigne: 'Vous écoutez la radio. Il s’agit d’une interview sur un sujet de société.',
                points: 9,
                maxPlays: 2,
                transcript: `Journaliste: Aujourd'hui, je reçois Martine Delaunay, maire de Villeneuve-le-Haut. C'est un village de sept cents habitants qui, il y a dix ans, perdait sa population, et qui accueille aujourd'hui de nouvelles familles.
Martine: Bonjour. Il faut se souvenir d'où l'on vient. Il y a dix ans, nous perdions une vingtaine d'habitants par an, la dernière épicerie avait fermé, et surtout, nous étions passés sous les trente élèves : l'école du village allait fermer. Et quand l'école ferme, plus aucune famille ne s'installe.
Journaliste: Par quoi avez-vous commencé ?
Martine: Pas par des travaux, contrairement à ce qu'on croit toujours. Nous avons commencé par la fibre : dans une commune comme la nôtre, une connexion lente, c'est une porte fermée. Ensuite, nous avons transformé l'ancienne école en un lieu partagé, avec des bureaux que l'on peut louer soixante euros par mois. Des gens qui travaillent à distance sont venus s'installer, d'abord deux familles, puis d'autres, parce qu'elles se sont parlé entre elles.
Journaliste: Avec quels résultats ?
Martine: Une quarantaine de familles en cinq ans, et l'école a rouvert une deuxième classe l'an dernier. Ça, c'est le signe qui ne trompe pas.
Journaliste: Et les difficultés ?
Martine: Il y en a, bien sûr. On me parle toujours du transport, et c'est vrai qu'ici il faut deux voitures par foyer. Mais le vrai obstacle aujourd'hui, ce n'est pas le transport, c'est le logement : nous avons des maisons vides dont les propriétaires ne veulent pas louer, parce qu'elles demanderaient trop de travaux.
Journaliste: Que conseilleriez-vous à quelqu'un qui nous écoute et qui rêve de s'installer à la campagne ?
Martine: De venir passer une semaine ici en hiver, pas au mois d'août. Un tiers des familles qui arrivent uniquement pour le prix des maisons repartent au bout de deux ans. Celles qui restent, ce sont celles qui savaient exactement où elles venaient.`,
                questions: [
                    { q: 'Combien d’habitants compte le village aujourd’hui ?', options: ['Trois cents', 'Sept cents', 'Deux mille'], answer: 1, points: 1 },
                    { q: 'Il y a dix ans, le village risquait surtout…', options: ['la fermeture de son école', 'la fermeture de sa mairie', 'de perdre sa gare'], answer: 0, points: 1 },
                    { q: 'Par quoi la commune a-t-elle commencé ?', options: ['Par installer la fibre', 'Par construire des logements neufs', 'Par rouvrir une épicerie'], answer: 0, points: 1 },
                    { q: 'Le lieu partagé a été aménagé dans…', options: ['l’ancienne épicerie', 'l’ancienne école', 'la mairie'], answer: 1, points: 1.5 },
                    { q: 'Combien de familles se sont installées en cinq ans ?', options: ['Une dizaine', 'Une quarantaine', 'Une centaine'], answer: 1, points: 1.5 },
                    { q: 'Selon la maire, le principal obstacle aujourd’hui, c’est…', options: ['le transport', 'le logement', 'le manque de travail'], answer: 1, points: 1.5 },
                    { q: 'Que conseille-t-elle aux personnes intéressées ?', options: ['De venir passer une semaine en hiver', 'De visiter le village au mois d’août', 'D’acheter une maison le plus vite possible'], answer: 0, points: 1.5 }
                ]
            }
        ]
    },

    pe: {
        minutes: 45,
        totalPoints: 25,
        minWords: 160,
        title: 'Production écrite — Essai / prise de position',
        consigne: 'Votre ville souhaite interdire les voitures dans le centre-ville le week-end. Le journal municipal invite les habitants à donner leur avis. Vous écrivez un article pour exprimer votre opinion sur cette mesure : vous présentez ses avantages et ses inconvénients, et vous donnez votre point de vue avec des exemples précis. (160 mots minimum)',
        model: 'Un centre-ville sans voitures le week-end : bonne ou mauvaise idée ?\n\nNotre ville propose d’interdire les voitures dans le centre le samedi et le dimanche. Cette mesure fait beaucoup discuter, et je souhaite donner mon avis.\n\nD’abord, les avantages sont évidents. Sans voitures, le centre serait plus calme et l’air plus respirable. Les familles pourraient se promener tranquillement, et les enfants circuler à vélo en sécurité. Dans les villes qui ont déjà essayé, comme Pontevedra en Espagne, les habitants profitent beaucoup plus de l’espace public.\n\nCependant, il ne faut pas oublier les inconvénients. Les personnes âgées et les familles qui habitent loin auraient des difficultés pour venir. Certains commerçants craignent aussi de perdre des clients.\n\nÀ mon avis, cette mesure est une bonne idée, mais à une condition : la ville doit proposer des solutions de transport, comme des bus gratuits et des parkings à l’entrée du centre. Ainsi, tout le monde pourrait profiter d’un centre-ville plus agréable sans être pénalisé.',
        // Grille d'évaluation OFICIAL de la production écrite B1 (nouveau format).
        // Fuente: B1_Grille_PE.pdf de France Éducation International (descargado 2026-07-19,
        // ver la nota delf-b1-formato del vault). NO inventar criterios ni máximos:
        // son 5 criterios, cada uno en la escala discreta 0 / 1 / 3 / 5 → total 25.
        // (La grille anterior de 6 criterios 2/4/4/3/6/6 quedó obsoleta con la reforma.)
        scale: [
            { pts: 0, label: 'Non répondu ou production insuffisante' },
            { pts: 1, label: 'En dessous du niveau ciblé' },
            { pts: 3, label: 'Au niveau ciblé — B1' },
            { pts: 5, label: 'Au niveau ciblé — B1+' }
        ],
        criteria: [
            { key: 'tache', label: 'Réalisation de la tâche', competence: 'Compétence pragmatique', max: 5,
              desc: '¿Respondes plenamente a la consigna? B1 = texto seguido que satisface globalmente la tarea y justifica la opinión con algunos ejemplos. B1+ = texto claro, plenamente adecuado, con ejemplos concretos o una argumentación simple.' },
            { key: 'coherence', label: 'Cohérence et cohésion', competence: 'Compétence pragmatique', max: 5,
              desc: 'B1 = conectores adecuados, puntuación y disposición usadas con criterio la mayor parte del tiempo. B1+ = texto claro y bien organizado con conectores variados que facilitan la lectura.' },
            { key: 'sociolinguistique', label: 'Adéquation sociolinguistique', competence: 'Compétence sociolinguistique', max: 5,
              desc: 'B1 = registro globalmente adaptado a la situación y al destinatario pese a confusiones puntuales. B1+ = adapta el registro al destinatario; las confusiones son raras y no incomodan al lector.' },
            { key: 'lexique', label: 'Lexique', competence: 'Compétence linguistique', max: 5,
              desc: 'B1 = vocabulario corriente sobre temas familiares, usa perífrasis para ideas complejas; hay errores de ortografía al expresar pensamientos complejos. B1+ = léxico amplio, temas de sociedad corrientes, ortografía suficientemente correcta para leerse con facilidad.' },
            { key: 'morphosyntaxe', label: 'Morphosyntaxe', competence: 'Compétence linguistique', max: 5,
              desc: 'B1 = domina las estructuras simples y muestra relativa corrección en las estructuras complejas corrientes. B1+ = buen control gramatical de las estructuras complejas más frecuentes, aunque poco variadas.' }
        ],
        // Reglas de anomalía de la grille oficial. Se aplican ANTES de llamar a la IA
        // cuando son deterministas (copie blanche, matière insuffisante).
        anomalies: {
            // < 50 % de las palabras pedidas → 0 en todos los criterios.
            minWordsEvaluable: 80, // 50 % de 160; el PDF oficial dice "79 mots ou moins" → 0
            horsSujetThematique: 'No puede recibir B1+ (5) en "tache" ni en "lexique".',
            horsSujetDiscursif: 'No puede recibir B1 (3) ni B1+ (5) en "tache" ni en "coherence".',
            horsSujetComplet: '0 en "tache", "coherence" y "sociolinguistique"; ni B1 ni B1+ en "lexique" y "morphosyntaxe".'
        }
    }
};

// Registro de tests DELF disponibles (para agregar niveles/tests futuros)
const DELF_TESTS = [DELF_TEST_B1_1];

// ─────────────────────────────────────────────────────────────────────────────
// Cómo un documento del CO encuentra su audio. Vive AQUÍ, en el dato, y no en
// cada uno de los dos que lo usan (el motor del examen en `delf-practice.js` y
// el tablero de montaje del admin en `admin-audio.js`): si cada uno llevara su
// copia, bastaría con tocar una para que el admin dijera «montado» y el alumno
// se quedara sin audio — y ese fallo no hace ruido, solo silencio.
//
// El orden de preferencia es deliberado:
//   1. `montadoEn` — un vínculo puesto a mano en el admin. Manda sobre todo lo
//      demás: existe justo para los casos en que el texto ya no calza.
//   2. transcript idéntico (normalizado) — el camino normal: se genera el clip
//      desde el estudio con el transcript del documento y queda enganchado solo.
//   3. mismo `clipTipo` — último recurso. Suena algo, pero ⚠️ NO es el texto del
//      documento: el tablero lo marca en rojo porque es peor que el silencio si
//      nadie se entera.
const DELF_CO_MATCH = {
    // Ignora marcas de hablante y acentos, y corta a 300 caracteres: compara
    // «es el mismo documento», no «es idéntico carácter a carácter».
    normalizar(t) {
        return (t || '')
            .replace(/^[ \t]*[A-Za-zÀ-ÿ0-9 _-]{1,20}:[ \t]*/gm, ' ')   // marcas de hablante
            .normalize('NFD').replace(/[̀-ͯ]/g, '')          // acentos
            .replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 300);
    },

    // `banco` debe venir con el más nuevo primero: si hay varias versiones de un
    // documento, gana la última generada.
    buscar(doc, banco) {
        const lista = banco || [];
        const porMontaje = lista.find(c => c.montadoEn && c.montadoEn === doc.id);
        if (porMontaje) return { clip: porMontaje, via: 'montado' };
        const esperado = this.normalizar(doc.transcript);
        const porTexto = lista.find(c => this.normalizar(c.transcript) === esperado);
        if (porTexto) return { clip: porTexto, via: 'transcript' };
        const porTipo = lista.find(c => c.tipo === doc.clipTipo);
        if (porTipo) return { clip: porTipo, via: 'tipo' };
        return { clip: null, via: 'falta' };
    }
};
