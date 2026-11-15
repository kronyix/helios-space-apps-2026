# Translation Review — Machine-Translated Strings (`pt-BR`)

All `pt-BR` (Brazilian Portuguese) comic and UI strings are marked `"reviewStatus": "machine-translated"` in `src/data/locales/pt-BR/missions.json` and `src/data/locales/pt-BR/ui.json`.
Existing `hi`, `es`, and `fr` translations were already present in the repository (human/team-reviewed baseline, 0 missing lines).

Rules enforced by `scripts/check-locales.ts`:
- Target register: ages 10–16, clear and natural storytelling.
- Proper names kept verbatim: `Spirit`, `Opportunity`, `Eagle`, `Columbia`, `Ingenuity`, `Perseverance`, `Home Plate`, `Tranquility Base`, `Apollo 11`, `Saturn V`, `USS Hornet`, `NASA`, `RPM`.
- Every number, date, and unit matches the English source (`pt-BR` decimal comma and thousands period formatting).

## ISSUE 01 · THE 90-DAY ROVERS (`opportunity`) — reviewStatus: `machine-translated`

| Key | Speaker / Kind | English Source | Portuguese (`pt-BR`) |
|---|---|---|---|
| `opportunity.meta.title` | meta | THE 90-DAY ROVERS | OS ROVERS DE 90 DIAS |
| `opportunity.meta.disclaimer` | meta | Speech balloons are dramatized. Caption boxes are documented history. | Os balões de fala são dramatizados (narração ficcionalizada). As caixas de legenda são história documentada. |
| `opportunity.meta.creditsNote` | meta | Dates as published by NASA Science (US Pacific time); UTC landing dates are one day later. | Datas publicadas pela NASA Science (horário do Pacífico dos EUA); em UTC, os pousos ocorreram um dia depois. |
| `opportunity.comic.p01.stamp` | stamp | SPIRIT · GUSEV CRATER · JAN 3, 2004 | SPIRIT · CRATERA GUSEV · 3 JAN 2004 |
| `opportunity.comic.p01.lines.p01-c1` | caption (narrator) | January 2004. Two identical robot twins are sent to opposite sides of Mars to hunt for signs of past water. Spirit lands first, cushioned by airbags, in Gusev Crater. | Janeiro de 2004. Dois robôs gêmeos idênticos são enviados para lados opostos de Marte em busca de sinais de água antiga. Spirit pousa primeiro, amortecido por airbags, na Cratera Gusev. |
| `opportunity.comic.p01.lines.p01-s1` | speech (SPIRIT) | Bounce... bounce... bounce... did we make it? | Quica... quica... quica... será que conseguimos? |
| `opportunity.comic.p02.stamp` | stamp | OPPORTUNITY · MERIDIANI PLANUM · JAN 24, 2004 | OPPORTUNITY · MERIDIANI PLANUM · 24 JAN 2004 |
| `opportunity.comic.p02.lines.p02-c1` | caption (narrator) | Three weeks later, Opportunity lands at Meridiani Planum, where minerals hinted at a wet past. Both rovers were planned for just 90 sols, about three months. | Três semanas depois, Opportunity pousa em Meridiani Planum, onde minerais indicavam um passado úmido. Ambos os rovers foram planejados para apenas 90 sóis, cerca de três meses. |
| `opportunity.comic.p02.lines.p02-s1` | speech (OPPORTUNITY) | Ninety sols. That's the promise. Let's make every one count. | Noventa sóis. Essa é a promessa. Vamos fazer cada um valer a pena. |
| `opportunity.comic.p03.stamp` | stamp | SPIRIT · GUSEV CRATER | SPIRIT · CRATERA GUSEV |
| `opportunity.comic.p03.lines.p03-c1` | caption (narrator) | Later in the mission, one of Spirit's six wheels stopped turning. The team kept driving, dragging the stuck wheel behind. | Mais tarde na missão, uma das seis rodas de Spirit parou de girar. A equipe continuou dirigindo, arrastando a roda travada. |
| `opportunity.comic.p03.lines.p03-s1` | speech (SPIRIT) | One wheel quit on me. I've got five more, and somewhere to be. | Uma roda parou de funcionar. Ainda tenho mais cinco e um lugar para chegar. |
| `opportunity.comic.p04.stamp` | stamp | SPIRIT · HOME PLATE · MARCH 2007 | SPIRIT · HOME PLATE · MARÇO 2007 |
| `opportunity.comic.p04.lines.p04-c1` | caption (narrator) | March 2007. Spirit's dragging wheel plows up bright soil: about 90% pure silica, at a place called Home Plate. On Earth, silica like this forms in hot springs and steam vents. | Março de 2007. A roda arrastada de Spirit revolve um solo brilhante: cerca de 90% de sílica pura, em um lugar chamado Home Plate. Na Terra, sílica assim se forma em fontes termais e fendas de vapor. |
| `opportunity.comic.p04.lines.p04-s1` | speech (SPIRIT) | My broken wheel just dug up a clue! | Minha roda quebrada acabou de desenterrar uma pista! |
| `opportunity.comic.p05.stamp` | stamp | OPPORTUNITY · NEAR FRAM CRATER · APRIL 2004 | OPPORTUNITY · PERTO DA CRATERA FRAM · ABRIL 2004 |
| `opportunity.comic.p05.lines.p05-c1` | caption (narrator) | April 2004. Opportunity examines tiny round grains of hematite, a mineral that usually forms in water. Scientists nicknamed them 'blueberries'. | Abril de 2004. Opportunity examina minúsculos grãos redondos de hematita, um mineral que geralmente se forma na água. Os cientistas os apelidaram de «mirtilos». |
| `opportunity.comic.p05.lines.p05-s1` | speech (OPPORTUNITY) | Tiny spheres, everywhere. The rocks are talking! | Pequenas esferas por toda parte. As rochas estão falando! |
| `opportunity.comic.p06.stamp` | stamp | OPPORTUNITY · MERIDIANI PLANUM | OPPORTUNITY · MERIDIANI PLANUM |
| `opportunity.comic.p06.lines.p06-c1` | caption (narrator) | The clues added up: ancient water soaked Meridiani Planum. But it was salty and acidic, a tough place for life, not a sparkling blue sea. | As pistas se encaixaram: água antiga encharcou Meridiani Planum. Mas era salgada e ácida, um ambiente difícil para a vida, não um mar azul brilhante. |
| `opportunity.comic.p06.lines.p06-s1` | speech (OPPORTUNITY) | Picture it: water, right where I'm standing. | Imagine só: água, bem onde estou agora. |
| `opportunity.comic.p07.stamp` | stamp | OPPORTUNITY | OPPORTUNITY |
| `opportunity.comic.p07.lines.p07-c1` | caption (narrator) | Dust piled up on Opportunity's solar panels. No one was there to brush it off. | A poeira se acumulou nos painéis solares de Opportunity. Não havia ninguém lá para limpá-la. |
| `opportunity.comic.p07.lines.p07-s1` | speech (OPPORTUNITY) | If only someone could brush this dust away... | Se ao menos alguém pudesse varrer essa poeira... |
| `opportunity.comic.p08.stamp` | stamp | OPPORTUNITY · JUNE 10, 2018 | OPPORTUNITY · 10 JUN 2018 |
| `opportunity.comic.p08.lines.p08-c1` | caption (narrator) | June 10, 2018. A planet-wide dust storm blankets Opportunity's location. It is the rover's last contact with Earth. | 10 de junho de 2018. Uma tempestade de poeira em todo o planeta cobre a região de Opportunity. É o último contato do rover com a Terra. |
| `opportunity.comic.p08.lines.p08-s1` | speech (OPPORTUNITY) | The sky is going dark. But look how much we saw. | O céu está escurecendo. Mas olhe quanta coisa nós vimos. |
| `opportunity.comic.p09.stamp` | stamp | SPIRIT & OPPORTUNITY | SPIRIT E OPPORTUNITY |
| `opportunity.comic.p09.lines.p09-c1` | caption (narrator) | Planned for about three months, Opportunity worked for 14 years and drove 28.06 miles (45.16 km). Spirit drove 4.8 miles (7.7 km) and finished its mission in 2010. | Planejado para cerca de três meses, Opportunity trabalhou por 14 anos e percorreu 28,06 milhas (45,16 km). Spirit percorreu 4,8 milhas (7,7 km) e encerrou sua missão em 2010. |
| `opportunity.comic.p09.lines.p09-c2` | caption (narrator) | Opportunity held the off-Earth driving record until October 11, 2026, when Perseverance passed it. | Opportunity manteve o recorde de distância percorrida fora da Terra até 11 de outubro de 2026, quando Perseverance o superou. |
| `opportunity.comic.p09.lines.p09-c3` | caption (narrator) | Built for 90 sols. They rewrote the story of Mars. | Construídos para 90 sóis. Eles reescreveram a história de Marte. |

## ISSUE 02 · THE WEIGHT TRADE (`apollo11`) — reviewStatus: `machine-translated`

| Key | Speaker / Kind | English Source | Portuguese (`pt-BR`) |
|---|---|---|---|
| `apollo11.meta.title` | meta | THE WEIGHT TRADE | A TROCA DE PESO |
| `apollo11.meta.disclaimer` | meta | Speech balloons are dramatized. Caption boxes are documented history. | Os balões de fala são dramatizados (narração ficcionalizada). As caixas de legenda são história documentada. |
| `apollo11.meta.creditsNote` | meta | Dates are US Eastern time, as NASA reported them during the mission. | As datas estão no horário do Leste dos EUA, conforme divulgadas pela NASA durante a missão. |
| `apollo11.comic.p01.stamp` | stamp | APOLLO 11 · KENNEDY SPACE CENTER · JULY 16, 1969 | APOLLO 11 · CENTRO ESPACIAL KENNEDY · 16 JUL 1969 |
| `apollo11.comic.p01.lines.p01-c1` | caption (narrator) | July 16, 1969. A Saturn V rocket, 110 metres tall, lifts Apollo 11 off the pad at Kennedy Space Center with three astronauts aboard. | 16 de julho de 1969. Um foguete Saturn V, com 110 metros de altura, lança a Apollo 11 da plataforma no Centro Espacial Kennedy com três astronautas a bordo. |
| `apollo11.comic.p01.lines.p01-s1` | speech (EAGLE) | Folded up inside a rocket, heading for the Moon. | Dobrado dentro de um foguete, rumo à Lua. |
| `apollo11.comic.p02.stamp` | stamp | EAGLE & COLUMBIA · LUNAR ORBIT · JULY 20, 1969 | EAGLE E COLUMBIA · ÓRBITA LUNAR · 20 JUL 1969 |
| `apollo11.comic.p02.lines.p02-c1` | caption (narrator) | July 20, 1969. In orbit around the Moon, the lunar module Eagle separates from the command module Columbia. Michael Collins stays aboard Columbia. | 20 de julho de 1969. Em órbita ao redor da Lua, o módulo lunar Eagle se separa do módulo de comando Columbia. Michael Collins permanece a bordo da Columbia. |
| `apollo11.comic.p02.lines.p02-s1` | speech (EAGLE) | Goodbye, Columbia. Keep the lights on for us. | Até logo, Columbia. Deixe as luzes acesas para nós. |
| `apollo11.comic.p03.stamp` | stamp | EAGLE · POWERED DESCENT | EAGLE · DESCIDA PROPULSIONADA |
| `apollo11.comic.p03.lines.p03-c1` | caption (narrator) | The computer is steering toward a field of boulders. Neil Armstrong takes manual control and flies past it, landing with very little fuel to spare. | O computador está guiando a nave para um campo de rochas. Neil Armstrong assume o controle manual e passa por cima dele, pousando com pouquíssimo combustível de reserva. |
| `apollo11.comic.p03.lines.p03-s1` | speech (EAGLE) | Boulders below! Easy… easy… fuel's getting low. | Rochas lá embaixo! Devagar… devagar… o combustível está acabando. |
| `apollo11.comic.p04.stamp` | stamp | EAGLE · TRANQUILITY BASE · JULY 20, 1969 | EAGLE · TRANQUILITY BASE · 20 JUL 1969 |
| `apollo11.comic.p04.lines.p04-c1` | caption (narrator) | July 20, 1969. "Houston, Tranquility Base here. The Eagle has landed." | 20 de julho de 1969. «Houston, aqui é Tranquility Base. A Eagle pousou.» |
| `apollo11.comic.p04.lines.p04-s1` | speech (EAGLE) | Engine off. Dust settling. We're here. | Motor desligado. Poeira baixando. Chegamos. |
| `apollo11.comic.p05.stamp` | stamp | TRANQUILITY BASE · FIRST STEPS | TRANQUILITY BASE · PRIMEIROS PASSOS |
| `apollo11.comic.p05.lines.p05-c1` | caption (narrator) | Neil Armstrong steps onto the Moon, followed by Buzz Aldrin. There is no wind or rain on the Moon to blow their footprints away. | Neil Armstrong pisa na Lua, seguido por Buzz Aldrin. Não há vento nem chuva na Lua para apagar suas pegadas. |
| `apollo11.comic.p05.lines.p05-s1` | speech (EAGLE) | Their first steps. Up here, nothing blows footprints away. | Os primeiros passos deles. Aqui em cima, nada apaga as pegadas. |
| `apollo11.comic.p06.stamp` | stamp | TRANQUILITY BASE · SEISMOMETER & RETROREFLECTOR | TRANQUILITY BASE · SISMÔMETRO E RETRORREFLETOR |
| `apollo11.comic.p06.lines.p06-c1` | caption (narrator) | Aldrin sets up a seismometer to feel moonquakes, and a laser retroreflector: a panel of 100 prisms that bounces light straight back to where it came from. | Aldrin instala um sismômetro para sentir tremores lunares e um retrorrefletor a laser: um painel de 100 prismas que reflete a luz direto de volta para onde ela veio. |
| `apollo11.comic.p06.lines.p06-s1` | speech (EAGLE) | A mirror and a listener. Gifts to leave behind. | Um espelho e um ouvinte. Presentes para deixar para trás. |
| `apollo11.comic.p07.stamp` | stamp | TRANQUILITY BASE · 21.55 KG OF MOON | TRANQUILITY BASE · 21,55 KG DE LUA |
| `apollo11.comic.p07.lines.p07-c1` | caption (narrator) | The crew collects 21.55 kg of lunar rock and soil and seals it in boxes for the trip home. | A tripulação coleta 21,55 kg de rocha e solo lunar e os sela em caixas para a viagem de volta. |
| `apollo11.comic.p07.lines.p07-s1` | speech (EAGLE) | Every rock they pack is a reason to leave something behind. | Cada rocha que eles guardam é um motivo para deixar algo para trás. |
| `apollo11.comic.p08.stamp` | stamp | EAGLE · LIFTOFF FROM THE MOON · JULY 21, 1969 | EAGLE · DECOLAGEM DA LUA · 21 JUL 1969 |
| `apollo11.comic.p08.lines.p08-c1` | caption (narrator) | July 21, 1969. Eagle's upper stage lifts off, using the gold descent stage as its launch pad. Every kilogram left behind is fuel saved for the trip home. | 21 de julho de 1969. O estágio superior da Eagle decola, usando o estágio de descida dourado como plataforma de lançamento. Cada quilograma deixado para trás é combustível economizado para voltar para casa. |
| `apollo11.comic.p08.lines.p08-s1` | speech (EAGLE) | Go. I'll stay. I make a good launch pad. | Podem ir. Eu fico. Dou uma boa plataforma de lançamento. |
| `apollo11.comic.p09.stamp` | stamp | COLUMBIA · PACIFIC OCEAN · JULY 24, 1969 | COLUMBIA · OCEANO PACÍFICO · 24 JUL 1969 |
| `apollo11.comic.p09.lines.p09-c1` | caption (narrator) | July 24, 1969. Columbia splashes down in the Pacific Ocean, and the recovery ship USS Hornet picks up the crew and their Moon rocks. | 24 de julho de 1969. Columbia pousa nas águas do Oceano Pacífico, e o navio de resgate USS Hornet recolhe a tripulação e suas rochas lunares. |
| `apollo11.comic.p09.lines.p09-s1` | speech (COLUMBIA) | Splashdown! Twenty-one kilograms of Moon, safely home. | Pouso no mar! Vinte e um quilogramas de Lua, em casa em segurança. |
| `apollo11.comic.p10.stamp` | stamp | TRANQUILITY BASE · TODAY | TRANQUILITY BASE · HOJE |
| `apollo11.comic.p10.lines.p10-c1` | caption (narrator) | Today. The descent stage still stands at Tranquility Base. Observatories on Earth still fire lasers at the retroreflector to measure the Moon's distance to within millimetres. | Hoje. O estágio de descida ainda permanece em Tranquility Base. Observatórios na Terra ainda disparam lasers no retrorrefletor para medir a distância da Lua com precisão de milímetros. |
| `apollo11.comic.p10.lines.p10-s1` | speech (EAGLE) | Still here. Still sending your light back. | Ainda estou aqui. Ainda mandando a sua luz de volta. |
| `apollo11.comic.p11.stamp` | stamp | APOLLO 11 · THE WEIGHT TRADE | APOLLO 11 · A TROCA DE PESO |
| `apollo11.comic.p11.lines.p11-c1` | caption (narrator) | To bring 21.55 kg of Moon home, Apollo 11 left the heavy descent stage behind. It became the launch pad for the trip back. | Para trazer 21,55 kg de Lua para casa, a Apollo 11 deixou o pesado estágio de descida para trás. Ele se tornou a plataforma de lançamento para a viagem de volta. |
| `apollo11.comic.p11.lines.p11-c2` | caption (narrator) | Laser light fired from Earth reaches the retroreflector and comes back in about 2.5 seconds, measuring the Moon's distance more than 50 years later. | A luz de laser disparada da Terra alcança o retrorrefletor e volta em cerca de 2,5 segundos, medindo a distância da Lua mais de 50 anos depois. |
| `apollo11.comic.p11.lines.p11-c3` | caption (narrator) | Left behind on purpose. Still answering. | Deixado para trás de propósito. Ainda respondendo. |

## ISSUE 03 · FLIGHT 72 (`ingenuity`) — reviewStatus: `machine-translated`

| Key | Speaker / Kind | English Source | Portuguese (`pt-BR`) |
|---|---|---|---|
| `ingenuity.meta.title` | meta | FLIGHT 72 | VOO 72 |
| `ingenuity.meta.disclaimer` | meta | Speech balloons are dramatized. Caption boxes are documented history. | Os balões de fala são dramatizados (narração ficcionalizada). As caixas de legenda são história documentada. |
| `ingenuity.meta.creditsNote` | meta | Dates as published by NASA (US time). | Datas conforme publicadas pela NASA (horário dos EUA). |
| `ingenuity.comic.p01.stamp` | stamp | INGENUITY · JEZERO CRATER · FEB 18, 2021 | INGENUITY · CRATERA JEZERO · 18 FEV 2021 |
| `ingenuity.comic.p01.lines.p01-c1` | caption (narrator) | February 18, 2021. A sky crane lowers the Perseverance rover into Jezero Crater. Folded under its belly rides Ingenuity, a 1.8 kg helicopter. | 18 de fevereiro de 2021. Um guindaste aéreo desce o rover Perseverance na Cratera Jezero. Dobrado sob sua barriga viaja Ingenuity, um helicóptero de 1,8 kg. |
| `ingenuity.comic.p01.lines.p01-s1` | speech (INGENUITY) | Hold on tight. Next stop: Jezero Crater. | Segure firme. Próxima parada: Cratera Jezero. |
| `ingenuity.comic.p02.stamp` | stamp | INGENUITY · JEZERO CRATER · APRIL 3, 2021 | INGENUITY · CRATERA JEZERO · 3 ABR 2021 |
| `ingenuity.comic.p02.lines.p02-c1` | caption (narrator) | April 3, 2021. Perseverance sets Ingenuity down on the crater floor and drives away. For the first time, the helicopter is on its own. | 3 de abril de 2021. Perseverance coloca Ingenuity no chão da cratera e se afasta. Pela primeira vez, o helicóptero está por conta própria. |
| `ingenuity.comic.p02.lines.p02-s1` | speech (INGENUITY) | Okay. Just me now. | Certo. Agora sou só eu. |
| `ingenuity.comic.p03.stamp` | stamp | INGENUITY · FIRST NIGHT ALONE | INGENUITY · PRIMEIRA NOITE SOZINHO |
| `ingenuity.comic.p03.lines.p03-c1` | caption (narrator) | Its first night alone. Temperatures can drop to about −90 °C, so Ingenuity must keep its electronics warm with battery power until the Sun returns. | Sua primeira noite sozinho. As temperaturas podem cair para cerca de −90 °C, então Ingenuity precisa manter seus circuitos aquecidos com a energia da bateria até o Sol voltar. |
| `ingenuity.comic.p03.lines.p03-s1` | speech (INGENUITY) | So cold… keep the heaters on. Wait for the Sun. | Que frio… mantenha os aquecedores ligados. Espere pelo Sol. |
| `ingenuity.comic.p04.stamp` | stamp | INGENUITY · FLIGHT 1 · APRIL 19, 2021 | INGENUITY · VOO 1 · 19 ABR 2021 |
| `ingenuity.comic.p04.lines.p04-c1` | caption (narrator) | April 19, 2021. Ingenuity rises 3 metres and hovers for about 30 seconds: the first powered, controlled flight on another planet. | 19 de abril de 2021. Ingenuity sobe 3 metros e paira por cerca de 30 segundos: o primeiro voo motorizado e controlado em outro planeta. |
| `ingenuity.comic.p04.lines.p04-s1` | speech (INGENUITY) | I'm flying. On Mars! | Estou voando. Em Marte! |
| `ingenuity.comic.p05.stamp` | stamp | INGENUITY · SCOUT FOR PERSEVERANCE | INGENUITY · BATEDOR DO PERSEVERANCE |
| `ingenuity.comic.p05.lines.p05-c1` | caption (narrator) | Ingenuity was planned for just five test flights. After passing them, it becomes a scout, flying ahead to photograph the rover's route. | Ingenuity foi planejado para apenas cinco voos de teste. Depois de completá-los, torna-se um batedor, voando à frente para fotografar o caminho do rover. |
| `ingenuity.comic.p05.lines.p05-s1` | speech (INGENUITY) | I'll check the path ahead. Follow me! | Vou verificar o caminho à frente. Siga-me! |
| `ingenuity.comic.p06.stamp` | stamp | INGENUITY · MARTIAN WINTER | INGENUITY · INVERNO MARCIANO |
| `ingenuity.comic.p06.lines.p06-c1` | caption (narrator) | Martian winter brings dust, weaker sunlight and colder nights. With less power to recharge its batteries, every flight gets harder. | O inverno marciano traz poeira, luz solar mais fraca e noites mais frias. Com menos energia para recarregar as baterias, cada voo fica mais difícil. |
| `ingenuity.comic.p06.lines.p06-s1` | speech (INGENUITY) | Dust on my solar panel. Just a little more sunlight, please. | Poeira no meu painel solar. Só mais um pouquinho de sol, por favor. |
| `ingenuity.comic.p07.stamp` | stamp | INGENUITY · 72 FLIGHTS | INGENUITY · 72 VOOS |
| `ingenuity.comic.p07.lines.p07-c1` | caption (narrator) | Over nearly three years, Ingenuity flies 72 times, covering about 17 km and climbing as high as 24 metres. | Em quase três anos, Ingenuity voa 72 vezes, percorrendo cerca de 17 km e subindo até 24 metros de altura. |
| `ingenuity.comic.p07.lines.p07-s1` | speech (INGENUITY) | Planned for five flights. Look at me now! | Planejado para cinco voos. Olhe para mim agora! |
| `ingenuity.comic.p08.stamp` | stamp | INGENUITY · FLIGHT 72 · JAN 18, 2024 | INGENUITY · VOO 72 · 18 JAN 2024 |
| `ingenuity.comic.p08.lines.p08-c1` | caption (narrator) | January 18, 2024. Over smooth, featureless sand ripples, its navigation camera can't track the ground. Ingenuity lands hard, and its rotor blades break. | 18 de janeiro de 2024. Sobre dunas de areia lisas e sem marcas, sua câmera de navegação não consegue rastrear o solo. Ingenuity pousa com força e as pás do rotor se quebram. |
| `ingenuity.comic.p08.lines.p08-s1` | speech (INGENUITY) | Can't see the ground… brace! | Não consigo ver o chão… segure firme! |
| `ingenuity.comic.p09.stamp` | stamp | INGENUITY · JANUARY 25, 2024 | INGENUITY · 25 JAN 2024 |
| `ingenuity.comic.p09.lines.p09-c1` | caption (narrator) | January 25, 2024. NASA announces that Ingenuity's flying days are over. Weeks later, Perseverance photographs its old friend from far away before driving on. | 25 de janeiro de 2024. A NASA anuncia que os dias de voo de Ingenuity terminaram. Semanas depois, Perseverance fotografa seu velho amigo de longe antes de seguir viagem. |
| `ingenuity.comic.p09.lines.p09-s1` | speech (INGENUITY) | Go on, Perseverance. I'll stay here. | Pode seguir, Perseverance. Eu fico por aqui. |
| `ingenuity.comic.p10.stamp` | stamp | INGENUITY · TODAY | INGENUITY · HOJE |
| `ingenuity.comic.p10.lines.p10-c1` | caption (narrator) | Today. Ingenuity can no longer fly, but it stays on as a stationary station, still collecting data on the surface of Mars. | Hoje. Ingenuity não pode mais voar, mas continua ativo como uma estação fixa, ainda coletando dados na superfície de Marte. |
| `ingenuity.comic.p10.lines.p10-s1` | speech (INGENUITY) | I can't fly anymore. But I'm still listening. | Não posso mais voar. Mas ainda estou escutando. |
| `ingenuity.comic.p11.stamp` | stamp | INGENUITY · FLIGHT 72 | INGENUITY · VOO 72 |
| `ingenuity.comic.p11.lines.p11-c1` | caption (narrator) | Mars's air is about 1% as dense as Earth's. To lift off, Ingenuity's rotors had to spin at about 2,537 RPM. | O ar de Marte tem cerca de 1% da densidade do ar da Terra. Para decolar, os rotores de Ingenuity precisavam girar a cerca de 2.537 RPM. |
| `ingenuity.comic.p11.lines.p11-c2` | caption (narrator) | Planned for up to five flights in 30 sols, Ingenuity flew 72 times in nearly three years. | Planejado para até cinco voos em 30 sóis, Ingenuity voou 72 vezes em quase três anos. |
| `ingenuity.comic.p11.lines.p11-c3` | caption (narrator) | Built to prove it could fly. It opened the sky of another world. | Construído para provar que podia voar. Ele abriu o céu de outro mundo. |
