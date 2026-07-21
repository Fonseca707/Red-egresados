// ─────────────────────────────────────────────────────────────────────────────
// Banco de contenido — Módulo TOEFL (formato nuevo, enero 2026)
// Reading: adaptativo en 2 módulos (módulo 2 fácil o difícil según módulo 1).
//   Tareas: complete_words | daily_life | academic
// Writing: build_sentence (10) + email (7 min) + discussion (10 min).
// Todo el contenido del examen va en inglés; la interfaz, en español.
// ─────────────────────────────────────────────────────────────────────────────

const TOEFL_TEST_1 = {
    id: 'toefl-practice-1',
    name: 'Práctica completa 1',

    reading: {
        // Umbral de aciertos del módulo 1 para pasar al módulo 2 difícil
        adaptiveThreshold: 0.65,

        module1: {
            label: 'Módulo 1 · Dificultad estándar (igual para todos)',
            minutes: 13,
            tasks: [
                {
                    type: 'complete_words',
                    title: 'Complete the Words',
                    instructions: 'Some words in the paragraph are incomplete. Type the missing letters to complete each word.',
                    // text usa [[n]] como marcador; gaps[n-1] define prefijo visible y letras faltantes
                    text: 'Bees play an essential role in agriculture. As they move from flower to flower collecting nectar, they [[1]] pollen between plants, allowing them to [[2]]. Without this natural [[3]], many of the fruits and vegetables we eat every day would [[4]] from our markets. In recent years, however, bee [[5]] have declined at an alarming rate. Scientists point to several possible [[6]], including the widespread use of chemical [[7]], the loss of natural habitats, and changing [[8]] conditions. Protecting bees is not simply an environmental concern; it is a matter of food [[9]] for millions of people around the [[10]].',
                    gaps: [
                        { prefix: 'trans', missing: 'fer' },
                        { prefix: 'repro', missing: 'duce' },
                        { prefix: 'pro', missing: 'cess' },
                        { prefix: 'disa', missing: 'ppear' },
                        { prefix: 'popula', missing: 'tions' },
                        { prefix: 'cau', missing: 'ses' },
                        { prefix: 'pesti', missing: 'cides' },
                        { prefix: 'clim', missing: 'ate' },
                        { prefix: 'secu', missing: 'rity' },
                        { prefix: 'wor', missing: 'ld' }
                    ]
                },
                {
                    type: 'daily_life',
                    title: 'Read in Daily Life',
                    instructions: 'Read the text and answer the questions.',
                    textLabel: 'Email',
                    text: 'From: Campus Housing Office\nTo: All residents of Pine Hall\nSubject: Water maintenance — Thursday\n\nDear residents,\n\nPlease be advised that the water supply in Pine Hall will be turned off this Thursday from 9:00 a.m. to 1:00 p.m. while our team replaces a broken pipe on the second floor. During this time, showers and laundry rooms will not be available. Bottled water will be provided at the front desk. We apologize for the inconvenience and appreciate your patience.\n\nCampus Housing Office',
                    questions: [
                        {
                            q: 'Why was this email sent?',
                            options: [
                                'To announce a temporary interruption of a service',
                                'To ask residents to help repair a pipe',
                                'To inform residents that Pine Hall will close',
                                'To invite residents to a meeting at the front desk'
                            ],
                            answer: 0
                        },
                        {
                            q: 'What can residents get at the front desk on Thursday?',
                            options: [
                                'Laundry tokens',
                                'Bottled water',
                                'A repair schedule',
                                'New room keys'
                            ],
                            answer: 1
                        }
                    ]
                },
                {
                    type: 'daily_life',
                    title: 'Read in Daily Life',
                    instructions: 'Read the text and answer the questions.',
                    textLabel: 'Notice',
                    text: 'CITY LIBRARY — SUMMER HOURS\n\nStarting June 15, the library will open from 8:00 a.m. to 9:00 p.m., Monday through Saturday. On Sundays, only the reading room will be open, from 10:00 a.m. to 4:00 p.m. Study rooms may be reserved online up to one week in advance. Please note that the children’s section will be closed during July for renovations.',
                    questions: [
                        {
                            q: 'What is available on Sundays?',
                            options: [
                                'The full library',
                                'Only the study rooms',
                                'Only the reading room',
                                'Only the children’s section'
                            ],
                            answer: 2
                        },
                        {
                            q: 'What will happen in July?',
                            options: [
                                'The library will extend its hours',
                                'Online reservations will be suspended',
                                'The children’s section will be closed',
                                'The reading room will be renovated'
                            ],
                            answer: 2
                        }
                    ]
                },
                {
                    type: 'academic',
                    title: 'Read an Academic Passage',
                    instructions: 'Read the passage and answer the questions.',
                    textLabel: 'Passage',
                    text: 'The Printing Press and the Spread of Ideas\n\nBefore the fifteenth century, books in Europe were copied by hand, a slow and expensive process that limited reading to a small elite. Around 1440, Johannes Gutenberg introduced a printing press that used movable metal type. This invention dramatically reduced the cost and time required to produce books. Within a few decades, printing shops had appeared in cities across Europe, and millions of books were in circulation. The consequences reached far beyond the book trade. Because printed texts were identical, scholars in different countries could discuss the same works with confidence, accelerating scientific debate. Religious and political pamphlets, cheap and quick to produce, carried new ideas to ordinary people rather than only to scholars. Some historians argue that movements such as the Reformation would have spread far more slowly, or perhaps failed entirely, without the press. Although later technologies would transform communication again, the printing press established a principle that still shapes modern media: reducing the cost of copying information multiplies its influence.',
                    questions: [
                        {
                            q: 'What is the main idea of the passage?',
                            options: [
                                'Gutenberg became wealthy from his invention',
                                'The printing press transformed how ideas spread in Europe',
                                'Handwritten books were of higher quality than printed ones',
                                'The Reformation was caused only by religious factors'
                            ],
                            answer: 1
                        },
                        {
                            q: 'According to the passage, why could scholars in different countries debate more effectively after printing appeared?',
                            options: [
                                'They could travel more easily between cities',
                                'They all learned to read Latin',
                                'Printed copies of a text were identical',
                                'Universities began to share professors'
                            ],
                            answer: 2
                        },
                        {
                            q: 'The word "accelerating" in the passage is closest in meaning to:',
                            options: ['delaying', 'speeding up', 'complicating', 'ending'],
                            answer: 1
                        },
                        {
                            q: 'What does the passage suggest about pamphlets?',
                            options: [
                                'They were mostly read by scholars',
                                'They were too expensive for ordinary people',
                                'They helped new ideas reach a wider public',
                                'They were banned in most European cities'
                            ],
                            answer: 2
                        },
                        {
                            q: 'Why does the author mention modern media in the final sentence?',
                            options: [
                                'To argue that printing is now obsolete',
                                'To show that a principle from printing still applies today',
                                'To criticize the quality of current journalism',
                                'To predict the next communication technology'
                            ],
                            answer: 1
                        }
                    ]
                }
            ]
        },

        module2easy: {
            label: 'Módulo 2 · Ruta sencilla (énfasis en vida diaria)',
            minutes: 14,
            tasks: [
                {
                    type: 'complete_words',
                    title: 'Complete the Words',
                    instructions: 'Some words in the paragraph are incomplete. Type the missing letters to complete each word.',
                    text: 'Getting enough sleep is one of the easiest ways to stay [[1]]. Most adults need between seven and nine [[2]] of sleep every night. When people do not sleep [[3]], they often feel tired and find it hard to [[4]] at work or school. Doctors [[5]] going to bed at the same time every night and avoiding coffee in the [[6]]. Turning off phones and computers before bed also [[7]], because bright screens keep the brain [[8]]. Small changes in daily [[9]] can lead to better rest and more [[10]] during the day.',
                    gaps: [
                        { prefix: 'heal', missing: 'thy' },
                        { prefix: 'ho', missing: 'urs' },
                        { prefix: 'eno', missing: 'ugh' },
                        { prefix: 'concen', missing: 'trate' },
                        { prefix: 'recomm', missing: 'end' },
                        { prefix: 'even', missing: 'ing' },
                        { prefix: 'hel', missing: 'ps' },
                        { prefix: 'awa', missing: 'ke' },
                        { prefix: 'habi', missing: 'ts' },
                        { prefix: 'ener', missing: 'gy' }
                    ]
                },
                {
                    type: 'daily_life',
                    title: 'Read in Daily Life',
                    instructions: 'Read the conversation and answer the questions.',
                    textLabel: 'Text messages',
                    text: 'Maya: Hey! Are we still meeting at the café at 4?\nLeo: About that... my bus is running late. Can we push it to 4:30?\nMaya: Sure. Should I order for you?\nLeo: Yes please! The usual — iced tea, no sugar.\nMaya: Got it. I’ll grab the table by the window.\nLeo: Perfect, see you soon!',
                    questions: [
                        {
                            q: 'Why does Leo want to change the meeting time?',
                            options: [
                                'He has to work late',
                                'His bus is delayed',
                                'He forgot the meeting',
                                'The café is closed until 4:30'
                            ],
                            answer: 1
                        },
                        {
                            q: 'What will Maya most likely do next?',
                            options: [
                                'Cancel the meeting',
                                'Take a different bus',
                                'Order an iced tea for Leo',
                                'Wait outside the café'
                            ],
                            answer: 2
                        }
                    ]
                },
                {
                    type: 'daily_life',
                    title: 'Read in Daily Life',
                    instructions: 'Read the text and answer the questions.',
                    textLabel: 'Poster',
                    text: 'COMMUNITY BIKE REPAIR DAY\nSaturday, May 9 — Central Park, north entrance\n10:00 a.m. – 3:00 p.m.\n\nFree basic repairs: brakes, tires, and chains.\nParts are not included — bring your own or buy them at the event.\nVolunteer mechanics welcome! Sign up at the information tent before 11:00 a.m.\nRain date: Sunday, May 10.',
                    questions: [
                        {
                            q: 'What is free at this event?',
                            options: [
                                'Bicycle parts',
                                'Basic repair work',
                                'New bicycles',
                                'Food and drinks'
                            ],
                            answer: 1
                        },
                        {
                            q: 'What happens if it rains on May 9?',
                            options: [
                                'The event moves indoors',
                                'The event is cancelled',
                                'The event moves to May 10',
                                'Only repairs are cancelled'
                            ],
                            answer: 2
                        }
                    ]
                },
                {
                    type: 'daily_life',
                    title: 'Read in Daily Life',
                    instructions: 'Read the text and answer the questions.',
                    textLabel: 'Receipt / invoice',
                    text: 'GREEN LEAF GROCERY — Receipt #4482\n\nApples (1 kg) ............ $3.50\nWhole wheat bread ........ $2.80\nMilk (2 L) ............... $4.20\nEggs (12) ................ $5.10\n\nSubtotal ................. $15.60\nMember discount (10%) .... -$1.56\nTOTAL .................... $14.04\n\nReturns accepted within 7 days with this receipt.\nThank you for shopping with us!',
                    questions: [
                        {
                            q: 'How much did the customer save with the discount?',
                            options: ['$1.56', '$14.04', '$15.60', '$4.20'],
                            answer: 0
                        },
                        {
                            q: 'What is required to return a product?',
                            options: [
                                'A membership card',
                                'The receipt, within 7 days',
                                'The original packaging',
                                'A reason in writing'
                            ],
                            answer: 1
                        }
                    ]
                },
                {
                    type: 'academic',
                    title: 'Read an Academic Passage',
                    instructions: 'Read the passage and answer the questions.',
                    textLabel: 'Passage',
                    text: 'Why Cities Plant Trees\n\nMany cities around the world are planting thousands of trees along their streets, and the reasons go beyond appearance. Trees provide shade that lowers the temperature of streets and buildings, which reduces the need for air conditioning during hot months. Their leaves capture dust and absorb polluting gases, improving the air that residents breathe. Trees also absorb rainwater, which helps prevent flooding after heavy storms. In addition, studies have found that streets with trees encourage people to walk more and may even reduce stress levels. Of course, urban trees require care: they must be watered, pruned, and protected from disease. But most city planners agree that the benefits are far greater than the costs.',
                    questions: [
                        {
                            q: 'What is the main purpose of the passage?',
                            options: [
                                'To explain the benefits of planting trees in cities',
                                'To describe how to care for urban trees',
                                'To compare cities with and without trees',
                                'To warn about diseases that affect trees'
                            ],
                            answer: 0
                        },
                        {
                            q: 'According to the passage, how do trees help during hot months?',
                            options: [
                                'They absorb rainwater',
                                'They provide shade that cools streets and buildings',
                                'They capture dust from the air',
                                'They encourage people to stay indoors'
                            ],
                            answer: 1
                        },
                        {
                            q: 'The passage mentions flooding to show that trees:',
                            options: [
                                'can be damaged by storms',
                                'need large amounts of water',
                                'help manage rainwater in cities',
                                'grow better in wet climates'
                            ],
                            answer: 2
                        },
                        {
                            q: 'What does the author conclude about urban trees?',
                            options: [
                                'They cost more than they are worth',
                                'Their benefits outweigh their costs',
                                'They should only be planted in parks',
                                'They reduce the value of buildings'
                            ],
                            answer: 1
                        }
                    ]
                }
            ]
        },

        module2hard: {
            label: 'Módulo 2 · Ruta exigente (énfasis académico)',
            minutes: 14,
            tasks: [
                {
                    type: 'complete_words',
                    title: 'Complete the Words',
                    instructions: 'Some words in the paragraph are incomplete. Type the missing letters to complete each word.',
                    text: 'Photosynthesis is the biochemical process by which plants convert light energy into chemical energy. Within specialized structures called chloroplasts, pigments [[1]] sunlight and use it to split water [[2]], releasing oxygen as a byproduct. The [[3]] carbon dioxide from the atmosphere is then [[4]] into glucose, which serves as the plant’s primary source of [[5]]. This process is fundamental to nearly all [[6]] on Earth: it produces the oxygen animals breathe and forms the [[7]] of most food chains. Scientists continue to study photosynthesis in the hope of designing [[8]] solar technologies that could [[9]] its remarkable efficiency under diverse environmental [[10]].',
                    gaps: [
                        { prefix: 'abs', missing: 'orb' },
                        { prefix: 'molec', missing: 'ules' },
                        { prefix: 'remain', missing: 'ing' },
                        { prefix: 'conver', missing: 'ted' },
                        { prefix: 'ener', missing: 'gy' },
                        { prefix: 'li', missing: 'fe' },
                        { prefix: 'ba', missing: 'sis' },
                        { prefix: 'artifi', missing: 'cial' },
                        { prefix: 'imit', missing: 'ate' },
                        { prefix: 'condi', missing: 'tions' }
                    ]
                },
                {
                    type: 'daily_life',
                    title: 'Read in Daily Life',
                    instructions: 'Read the text and answer the questions.',
                    textLabel: 'Memo',
                    text: 'INTERNAL MEMO\nFrom: Office of the Registrar\nTo: All undergraduate students\nRe: Course withdrawal deadline\n\nStudents wishing to withdraw from a course without academic penalty must submit the online withdrawal form no later than Friday, October 24, at 5:00 p.m. Withdrawals after this date will appear on transcripts with a grade of "W" and may affect eligibility for financial aid. Students are strongly encouraged to consult their academic advisor before making a final decision, as some degree programs require a minimum number of credits per term.',
                    questions: [
                        {
                            q: 'What happens if a student withdraws after October 24?',
                            options: [
                                'The withdrawal is not permitted',
                                'A "W" appears on the transcript and financial aid may be affected',
                                'The student must repeat the course',
                                'The advisor must approve the withdrawal'
                            ],
                            answer: 1
                        },
                        {
                            q: 'Why does the memo recommend consulting an advisor?',
                            options: [
                                'Advisors submit the withdrawal form',
                                'Some programs require a minimum number of credits per term',
                                'Advisors can extend the deadline',
                                'Financial aid is managed by advisors'
                            ],
                            answer: 1
                        }
                    ]
                },
                {
                    type: 'academic',
                    title: 'Read an Academic Passage',
                    instructions: 'Read the passage and answer the questions.',
                    textLabel: 'Passage',
                    text: 'The Mirror Test and Animal Self-Awareness\n\nIn 1970, psychologist Gordon Gallup devised an experiment to explore whether animals recognize themselves. In the "mirror test," a colored mark is placed on an animal where it can be seen only in a mirror. If the animal touches the mark on its own body after looking at its reflection, researchers infer that it understands the image represents itself. Chimpanzees, dolphins, elephants, and magpies have passed versions of the test, while most species react to the mirror as if facing a stranger. The test remains influential but controversial. Critics note that it favors animals that rely primarily on vision; dogs, for example, interpret the world largely through smell and may fail the test despite possessing some form of self-recognition. Others argue that passing the test demonstrates only body awareness, not the richer self-consciousness humans experience. Consequently, many researchers now treat the mirror test as one useful tool among several, rather than as a definitive measure of animal minds.',
                    questions: [
                        {
                            q: 'What is the main idea of the passage?',
                            options: [
                                'The mirror test proves that most animals are self-aware',
                                'The mirror test is a useful but debated measure of self-recognition',
                                'Dogs are more intelligent than the mirror test suggests',
                                'Gordon Gallup’s experiment was poorly designed'
                            ],
                            answer: 1
                        },
                        {
                            q: 'In the mirror test, an animal is considered to recognize itself when it:',
                            options: [
                                'ignores the mirror entirely',
                                'reacts to the reflection as a stranger',
                                'touches the mark on its own body',
                                'looks behind the mirror'
                            ],
                            answer: 2
                        },
                        {
                            q: 'Why are dogs mentioned in the passage?',
                            options: [
                                'To give an example of an animal that passed the test',
                                'To show a limitation of a vision-based test',
                                'To prove that smell is more important than vision',
                                'To describe a new version of the experiment'
                            ],
                            answer: 1
                        },
                        {
                            q: 'The word "definitive" in the passage is closest in meaning to:',
                            options: ['conclusive', 'popular', 'temporary', 'expensive'],
                            answer: 0
                        },
                        {
                            q: 'What can be inferred about current researchers?',
                            options: [
                                'They have abandoned the mirror test completely',
                                'They combine the mirror test with other methods',
                                'They believe all animals are self-aware',
                                'They only study animals that rely on vision'
                            ],
                            answer: 1
                        }
                    ]
                },
                {
                    type: 'academic',
                    title: 'Read an Academic Passage',
                    instructions: 'Read the passage and answer the questions.',
                    textLabel: 'Passage',
                    text: 'The Paradox of Choice\n\nConventional economic theory holds that more options lead to better outcomes: the wider the selection, the more likely consumers are to find exactly what they want. Yet psychological research suggests the relationship is more complicated. In a well-known study, shoppers at a grocery store were offered samples of jam from either a display of six varieties or one of twenty-four. Although the larger display attracted more attention, shoppers who saw it were roughly ten times less likely to make a purchase. Psychologist Barry Schwartz called this phenomenon "the paradox of choice." Facing many alternatives, people may feel anxious about choosing badly, postpone the decision altogether, or feel less satisfied afterward because they keep imagining the options they rejected. The effect does not appear in every situation—experts with clear preferences often benefit from large selections—but it has practical implications. Some companies have deliberately simplified their product lines, discovering that offering fewer choices can increase both sales and customer satisfaction.',
                    questions: [
                        {
                            q: 'What is the main point of the passage?',
                            options: [
                                'Consumers always prefer larger selections',
                                'Having many options can reduce satisfaction and decision-making',
                                'Jam is difficult to sell in grocery stores',
                                'Economic theory has been proven completely wrong'
                            ],
                            answer: 1
                        },
                        {
                            q: 'In the jam study, what was the effect of the larger display?',
                            options: [
                                'It attracted less attention but sold more',
                                'It attracted more attention but sold less',
                                'It sold the same as the small display',
                                'It was removed from the store'
                            ],
                            answer: 1
                        },
                        {
                            q: 'According to the passage, why might people feel less satisfied after choosing from many options?',
                            options: [
                                'The products are usually of lower quality',
                                'They keep thinking about the options they did not choose',
                                'Prices are higher when there are more options',
                                'They are forced to buy more than they need'
                            ],
                            answer: 1
                        },
                        {
                            q: 'Who tends to benefit from large selections, according to the passage?',
                            options: [
                                'First-time buyers',
                                'Anxious shoppers',
                                'Experts with clear preferences',
                                'Companies with simple product lines'
                            ],
                            answer: 2
                        }
                    ]
                }
            ]
        }
    },

    writing: {
        buildSentence: {
            title: 'Build a Sentence',
            minutes: 7,
            instructions: 'Lee cada mensaje y ordena las palabras para formar la respuesta correcta. Toca las fichas en orden; toca una ficha elegida para devolverla.',
            items: [
                {
                    context: 'A: "How was the concert last night?"',
                    answer: 'It was the best show I have ever seen.',
                    chips: ['It was', 'the best show', 'I have', 'ever seen.'],
                    distractors: ['It were']
                },
                {
                    context: 'A: "I heard the museum is free on Sundays."',
                    answer: 'Do you know if we need to reserve tickets in advance?',
                    chips: ['Do you know', 'if', 'we need to', 'reserve tickets', 'in advance?'],
                    distractors: ['does']
                },
                {
                    context: 'A: "Why is the kitchen such a mess?"',
                    answer: 'The cake was being decorated when I left.',
                    chips: ['The cake', 'was being', 'decorated', 'when I left.']
                },
                {
                    context: 'A: "Can anyone join the study group?"',
                    answer: 'Students who registered this semester are welcome to join.',
                    chips: ['Students', 'who registered', 'this semester', 'are welcome', 'to join.']
                },
                {
                    context: 'A: "What would you do with a free week?"',
                    answer: 'If I had more time, I would visit my grandparents.',
                    chips: ['If I had', 'more time,', 'I would', 'visit my grandparents.']
                },
                {
                    context: 'A: "The printer stopped working again."',
                    answer: 'It should have been repaired last month.',
                    chips: ['It', 'should have', 'been repaired', 'last month.']
                },
                {
                    context: 'A: "Did you enjoy the new restaurant?"',
                    answer: 'The food was so good that we ordered dessert twice.',
                    chips: ['The food', 'was so good', 'that we ordered', 'dessert twice.']
                },
                {
                    context: 'A: "I can’t find my keys anywhere."',
                    answer: 'They might have been left in the car.',
                    chips: ['They', 'might have been', 'left', 'in the car.'],
                    distractors: ['must to be']
                },
                {
                    context: 'A: "Is the report ready for the meeting?"',
                    answer: 'It will be finished by the time you arrive.',
                    chips: ['It will be', 'finished', 'by the time', 'you arrive.']
                },
                {
                    context: 'A: "How do I get to the train station?"',
                    answer: 'Take the second street on the left after the bank.',
                    chips: ['Take', 'the second street', 'on the left', 'after the bank.']
                }
            ]
        },

        email: {
            title: 'Write an Email',
            minutes: 7,
            targetWords: [100, 120],
            scenario: 'You are taking a biology course at your university. Last week you missed an important laboratory session because you were sick, and the professor’s syllabus says that missed labs can only be made up with prior approval. You have a doctor’s note and want to make up the session.',
            recipient: 'Write an email to Professor Reed.',
            to: 'Professor Reed',
            subject: 'Missed laboratory session',
            bullets: [
                'Explain why you missed the laboratory session',
                'Mention the doctor’s note you can provide',
                'Ask if and when you can make up the missed lab'
            ],
            model: 'Dear Professor Reed,\n\nI am writing about the laboratory session I missed last Wednesday. Unfortunately, I woke up that morning with a high fever, and my doctor advised me to stay home for several days. I understand that the syllabus requires prior approval for make-up labs, but my illness was unexpected and I could not request permission in advance.\n\nI have a doctor’s note confirming my situation, and I would be happy to send it to you or bring it to your office. Would it be possible to make up the session during another lab section this week or the next? I am available any afternoon.\n\nThank you very much for your understanding.\n\nBest regards,\nDaniel Torres'
        },

        discussion: {
            title: 'Write for an Academic Discussion',
            minutes: 10,
            targetWords: [100, 130],
            professor: {
                name: 'Professor Alvarez',
                post: 'This week we have been discussing how technology changes education. Some people believe that online learning will eventually replace traditional classrooms, while others think in-person teaching will always be necessary. In your opinion, should universities move most of their courses online? Why or why not?'
            },
            students: [
                {
                    name: 'Claire',
                    post: 'I think universities should move most courses online. Online classes are cheaper for students, and people can study from anywhere in the world. Recorded lectures also let students review difficult material as many times as they need.'
                },
                {
                    name: 'Andrew',
                    post: 'I disagree. In-person classes keep students motivated and make it easier to ask questions in the moment. Many of my friends stopped paying attention in online courses because nobody noticed whether they were engaged or not.'
                }
            ],
            model: 'Both Claire and Andrew make good points, but I believe universities should adopt a mixed model instead of moving most courses online. Claire is right that online courses reduce costs and increase access; however, this advantage mainly applies to lecture-based classes. Andrew’s concern about motivation shows why fully online programs often have higher dropout rates. In my view, the real issue is that different types of learning require different formats: theoretical content can be delivered online effectively, but laboratories, group projects, and discussions develop skills that screens cannot replicate, such as collaboration and improvisation. Universities should therefore classify each course by its practical component rather than applying one policy to everything.'
        },

        // Rúbrica oficial-style (bandas 1-6) para autoevaluación de email y discussion.
        // FUTURO: cuando se integre IA, estas mismas bandas alimentan el prompt del evaluador.
        rubric: [
            { band: 6, label: 'Excelente', desc: 'Cumple todos los puntos de la tarea con ideas bien desarrolladas. Vocabulario preciso y estructuras complejas casi sin errores. Tono apropiado.' },
            { band: 5, label: 'Muy bueno', desc: 'Cumple la tarea completa con buen desarrollo. Errores menores ocasionales que no afectan la comprensión.' },
            { band: 4, label: 'Bueno', desc: 'Cumple la mayoría de la tarea. Ideas claras pero con desarrollo limitado. Algunos errores gramaticales notorios.' },
            { band: 3, label: 'Aceptable', desc: 'Responde parcialmente la tarea. Vocabulario básico y errores frecuentes que a veces dificultan la comprensión.' },
            { band: 2, label: 'Limitado', desc: 'Omite puntos clave de la tarea. Oraciones cortas y repetitivas, errores constantes.' },
            { band: 1, label: 'Muy limitado', desc: 'No logra comunicar la tarea. Texto muy corto, desconectado o mayormente incomprensible.' }
        ]
    }
};

// Registro de tests disponibles (para agregar más en el futuro)
const TOEFL_TESTS = [TOEFL_TEST_1];
