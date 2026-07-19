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
