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
    // Los TRANSCRIPTS son los literales del sujet démo B1TP_02 (nouveau format,
    // France Éducation International) — los mismos que carga el botón «transcript
    // oficial de referencia» del estudio de audio. Por eso el examen encuentra
    // su audio solo: el clip que se genera desde ese botón queda emparejado por
    // transcript con el documento que le corresponde aquí.
    //
    // Las PREGUNTAS son de elaboración propia sobre esos documentos (el sujet
    // publica los guiones, no el cuestionario). Respetan lo que sí es oficial:
    // 3 documentos de 7 + 9 + 9 = 25 puntos y puntuación NO uniforme dentro de
    // cada ejercicio (conviven ítems de 1 y de 1,5).
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
                transcript: `Célia: Salut Lilian !
Lilian: Salut Célia ! Ça va ?
Célia: Génial ! Tu sais quoi ? Pour mes trente ans, je vais organiser un week-end à la montagne. Un week-end... sans enfants !
Lilian: C'est une super idée ! Tu sais déjà où ?
Célia: Mes parents ont une maison dans les Alpes. Ils nous la prêtent avec plaisir ! Et moi, je leur offre le restaurant pour leur dire merci !
Lilian: Génial ! Et tu vas inviter beaucoup de monde ?
Célia: Non, seulement mes meilleurs amis. On sera une dizaine. Je préfère quand il n'y a pas trop de gens, pour pouvoir parler avec tout le monde. Tu vas venir ?
Lilian: J'aimerais bien ! C'est quand ?
Célia: Les 20 et 21 janvier.
Lilian: Malheureusement, je travaille le samedi, mais je peux prendre le train après et passer la moitié du week-end avec vous ! Ça me ferait plaisir de partager ce moment avec toi, depuis tout le temps qu'on se connaît !
Célia: Oui, c'est parfait, tu arriveras juste à temps pour le grand repas d'anniversaire !
Lilian: Ça ne va pas te faire trop de choses à préparer ?
Célia: Non, je vais demander à chaque personne d'apporter quelque chose à manger, et moi, je m'occupe des boissons.
Lilian: C'est une bonne solution ! Et le dimanche, qu'est-ce qu'on va faire ?
Célia: J'espère qu'il va y avoir de la neige. Comme ça, on pourra faire du ski.
Lilian: J'aime beaucoup ce programme ! Et au fait... qu'est-ce que tu aimerais comme cadeau pour ton anniversaire ?
Célia: Hmm, j'ai réfléchi mais je ne veux pas de cadeau. En fait, ce qui est le plus important pour moi, c'est que vous soyez tous présents ce week-end-là !
Lilian: D'accord. Alors compte sur moi !`,
                questions: [
                    { q: 'Célia organise ce week-end pour…', options: ['son mariage', 'ses trente ans', 'la fin de l’année scolaire'], answer: 1, points: 1 },
                    { q: 'Où le week-end va-t-il se passer ?', options: ['Dans une maison de ses parents', 'Dans un hôtel à la montagne', 'Chez Lilian'], answer: 0, points: 1 },
                    { q: 'Combien de personnes sont invitées ?', options: ['Une dizaine', 'Une trentaine', 'Toute la famille'], answer: 0, points: 1 },
                    { q: 'Pourquoi Célia préfère-t-elle un petit groupe ?', options: ['Parce que la maison est petite', 'Pour pouvoir parler avec tout le monde', 'Parce que c’est moins cher'], answer: 1, points: 1.5 },
                    { q: 'Lilian arrivera…', options: ['le vendredi soir', 'le samedi après son travail', 'le dimanche matin'], answer: 1, points: 1.5 },
                    { q: 'Qu’est-ce que Célia veut comme cadeau ?', options: ['Rien : que ses amis soient présents', 'Une journée de ski', 'Un repas au restaurant'], answer: 0, points: 1 }
                ]
            },
            {
                id: 'co2',
                clipTipo: 'delf-radio-pro',
                title: 'Exercice 2 — Émission de radio',
                consigne: 'Vous écoutez la radio. Il s’agit d’une interview sur le monde associatif.',
                points: 9,
                maxPlays: 2,
                transcript: `Journaliste: Aujourd'hui, je vous présente l'association Un regard pour toi, qui propose à des personnes malvoyantes de faire leur shopping avec des bénévoles qui, eux, voient et les aident. Je suis avec Hayette Louail, 29 ans, qui a créé l'association. Bonjour Hayette, est-ce que vous pouvez nous expliquer pourquoi vous avez lancé Un regard pour toi ?
Hayette: Bonjour. Moi, je suis malvoyante. Quand je vais dans les magasins pour acheter des vêtements, je ne sais jamais si je vais trouver un vendeur disponible. Et même si un vendeur est là, ce n'est pas toujours facile : est-ce qu'il a bien compris ce que je cherche ? Les vendeurs vont vite, ils n'ont pas le temps... Moi, j'ai besoin de prendre mon temps... Alors j'ai pensé que des gens qui aiment faire du shopping pourraient m'aider en venant avec moi et en m'expliquant ce qu'ils voient !
Journaliste: Qu'est-ce que ça a changé dans votre expérience du shopping ?
Hayette: J'adore quand un bénévole me suggère une façon différente de m'habiller. Il me décrit un vêtement, et je pense, oh la la, non, ce n'est pas du tout pour moi ! mais j'essaie, et parfois, c'est vraiment super ! Grâce aux bénévoles, j'apprends à porter d'autres choses. Après, au travail, mes collègues me demandent où j'ai acheté mes vêtements.
Journaliste: Et si je veux aider l'association, comment est-ce que je fais ?
Hayette: Aujourd'hui, on a une cinquantaine de bénévoles, mais on est toujours à la recherche de nouvelles personnes, donc vous êtes le bienvenu. D'abord, vous aurez une réunion d'information pour rencontrer les autres bénévoles et préparer votre premier rendez-vous. Puis, c'est vous qui décidez à quel rythme vous faites des sorties shopping, et quand.`,
                questions: [
                    { q: 'L’association Un regard pour toi accompagne des personnes…', options: ['malvoyantes', 'âgées', 'sans emploi'], answer: 0, points: 1.5 },
                    { q: 'Hayette a créé l’association parce que, dans les magasins…', options: ['les prix sont trop élevés', 'elle ne trouve pas toujours un vendeur disponible', 'il n’y a pas de vêtements à sa taille'], answer: 1, points: 1.5 },
                    { q: 'Selon Hayette, le problème avec les vendeurs est aussi que…', options: ['ils vont vite et n’ont pas le temps', 'ils refusent de l’aider', 'ils ne parlent pas assez fort'], answer: 0, points: 1.5 },
                    { q: 'Ce qu’elle apprécie le plus chez les bénévoles, c’est qu’ils…', options: ['portent ses sacs', 'lui suggèrent une façon différente de s’habiller', 'lui font des réductions'], answer: 1, points: 1.5 },
                    { q: 'Aujourd’hui, l’association compte environ…', options: ['une quinzaine de bénévoles', 'une cinquantaine de bénévoles', 'deux cents bénévoles'], answer: 1, points: 1.5 },
                    { q: 'Pour devenir bénévole, la première étape est…', options: ['une réunion d’information', 'une formation de deux ans', 'un entretien avec un vendeur'], answer: 0, points: 1.5 }
                ]
            },
            {
                id: 'co3',
                clipTipo: 'delf-radio-soc',
                title: 'Exercice 3 — Émission de radio',
                consigne: 'Vous écoutez la radio. Il s’agit d’une interview sur un sujet de société.',
                points: 9,
                maxPlays: 2,
                transcript: `Journaliste: Aujourd'hui, je reçois François Dechy qui va nous parler de Baluchon. C'est une entreprise qu'il a créée à Romainville, en région parisienne.
François: Alors, Baluchon, c'est une petite entreprise qui existe depuis deux ans. On prépare des repas qu'on livre dans les entreprises, pour les salariés qui n'ont pas le temps de cuisiner eux-mêmes et qui en ont assez de manger des sandwichs en cinq minutes devant leur ordinateur... Je me suis rendu compte que les employés prenaient de moins en moins de temps pour déjeuner. Mais on sait que s'arrêter un bon moment et prendre un vrai repas permet d'être plus productif l'après-midi ! Je voulais donc créer un projet qui redonnait de l'importance au moment du déjeuner. Je voulais aussi que cette entreprise mette en valeur des produits locaux, cultivés naturellement et sans produits chimiques. Et puis, ce qui m'intéresse surtout, c'est l'humain. J'avais envie d'aider des gens qui ont du mal à trouver du travail, des personnes qui sont au chômage depuis longtemps ou des jeunes qui ont arrêté l'école. À Baluchon, ces personnes sont formées pendant deux ans pour apprendre un métier dans la restauration. Pour accéder à nos cours, on leur demande seulement de savoir parler français, écrire, et compter jusqu'à cent. Quand j'ai présenté le projet à ma ville, ils ont décidé de m'aider, et le maire nous a prêté une cuisine qui n'était pas utilisée depuis plusieurs années. On prépare tous les repas là-bas, et c'est vraiment pratique pour nous, parce que c'est très central ! Tous les jours, on a 30 cuisiniers qui préparent entre 400 et 1 000 repas. Par exemple, aujourd'hui, notre équipe prépare une crème de courgette à la menthe. Vous pouvez regarder les menus sur notre site internet. Pour commander, téléphonez au moins 48 heures à l'avance, surtout pour un grand groupe.`,
                questions: [
                    { q: 'Baluchon livre des repas…', options: ['dans les écoles', 'dans les entreprises', 'à domicile le week-end'], answer: 1, points: 1 },
                    { q: 'L’entreprise existe depuis…', options: ['deux ans', 'cinq ans', 'dix ans'], answer: 0, points: 1 },
                    { q: 'François a constaté que les employés…', options: ['prenaient de moins en moins de temps pour déjeuner', 'mangeaient trop', 'cuisinaient chez eux le soir'], answer: 0, points: 1 },
                    { q: 'Selon lui, prendre un vrai repas permet…', options: ['de faire des économies', 'd’être plus productif l’après-midi', 'de mieux dormir'], answer: 1, points: 1.5 },
                    { q: 'Les personnes recrutées sont formées pendant…', options: ['six mois', 'un an', 'deux ans'], answer: 2, points: 1.5 },
                    { q: 'La mairie a aidé le projet en…', options: ['prêtant une cuisine inutilisée', 'donnant de l’argent', 'trouvant des clients'], answer: 0, points: 1.5 },
                    { q: 'Pour commander, il faut téléphoner au moins…', options: ['24 heures à l’avance', '48 heures à l’avance', 'une semaine à l’avance'], answer: 1, points: 1.5 }
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
