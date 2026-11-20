-- Catalogue and media from kirillsql1kaa11/itd-awards-2026, commit c29aacaab999a43a710307785cf74209cb977a4a.
-- Archive only the exact older ballots. Their nominees and votes stay in PostgreSQL.
UPDATE nominations n
SET archived = true, status = 'closed'
FROM (VALUES
    ('KING ITD', ARRAY['Участник А', 'Участник Б', 'Участник В']),
    ('Ивент года', ARRAY['Событие А', 'Событие Б']),
    ('Сквад года', ARRAY['Команда А', 'Команда Б']),
    ('Баннер года', ARRAY['Работа А', 'Работа Б']),
    ('Интервью года', ARRAY['Беседа А', 'Беседа Б']),
    ('KING ITD', ARRAY['Ктсупер', 'Никита Аэро', 'Аббас', 'Тихая Тоска', 'Друзьяшка', 'Сэм', 'Skorlange', 'Бадик', 'Gatosich', 'Снейр']),
    ('QUEEN ITD', ARRAY['Зыска', 'Вика Вилка', 'Херока', 'Меок', 'Дреграв', 'Нарко', 'Kisssa', 'Аля', 'Емае', 'Дашуша', 'Японка Вич']),
    ('Шип года', ARRAY['зыска и херока', 'марура и сахар', 'Аббас и нарко', 'improfire и ranpard', 'вика вилка и никарончик', 'икстаузар и линчик', 'мявк и тихая тоска', 'пилозар и бабл', 'аэро и эка', 'емае и зерно', 'радан и бадя', 'соня и итдстатус']),
    ('Художник года', ARRAY['херока', 'кафтаняш', 'Яна вирдоу', 'винси', 'василини', 'олесок', 'муфи мухомор', 'ванна', 'мерша', 'юзилис сноумэн', 'ladnokay', 'd123']),
    ('Мем года', ARRAY['чикенбурбе', '🔥василини призналась', 'ИТД 2024', 'Барни', 'хы блы', 'Сливки', 'Ого', 'Тигр', 'Николай21', 'Остановсися', 'мем с Кунжутом', 'беременный новки'])
) AS old_ballot(title, names)
WHERE n.title = old_ballot.title AND NOT n.archived AND NOT n.suggestions_preview
    AND ARRAY(SELECT name FROM nominees WHERE nomination_id = n.id ORDER BY sort_order, id) = old_ballot.names;

CREATE TEMP TABLE award_catalog (
    slug text PRIMARY KEY,
    title text NOT NULL UNIQUE,
    description text NOT NULL,
    sort_order integer NOT NULL
) ON COMMIT DROP;

INSERT INTO award_catalog VALUES
    ('king-itd', 'KING ИТД', 'Тот, кто задаёт тон, собирает вокруг себя людей и делает сообщество громче. Один голос — один король.', 10),
    ('queen-itd', 'QUEEN ИТД', 'Голос, вкус и харизма, которые невозможно не заметить. В этом году королеву выбираете вы.', 20),
    ('ship-goda', 'Шип года', 'Самая громкая пара года — по версии сообщества. Любовь, дружба и немного драмы.', 30),
    ('artist-goda', 'Художник года', 'Работы, которые хочется сохранить в папку «вдохновение». Голос за самый узнаваемый визуал года.', 40),
    ('meme-goda', 'Мем года', 'Шутка, которая пережила свой дедлайн и до сих пор живёт в чатах. Выбираем самый вирусный мем.', 50),
    ('news-goda', 'Новостной паблик года', 'Туда, куда мы идём за правдой и скринами. Пять минут без воды — и вы в курсе.', 60),
    ('streamer-goda', 'Стример года', 'Эфиры, ради которых мы ставим будильник. За атмосферу, смелость и умение держать чат.', 70),
    ('cosplay-goda', 'Косплей года', 'Перевоплощение, в которое веришь больше, чем в оригинал. Костюмы, детали и характер.', 80),
    ('zavoz-goda', 'Завоз года', 'Самый красивый, неожиданный и нужный завоз. То, что приехало вовремя или изменило всё.', 90),
    ('event-goda', 'Событие года', 'День, о котором потом рассказывали месяц. Офлайн, онлайн и всё, что между ними.', 100),
    ('project-goda', 'Проект года', 'То, что выросло из идеи в целую вселенную. Голос за проект, который двигает ITD вперёд.', 110),
    ('track-goda', 'Трек года', 'Трек, который звучал громче всего в этом году. Один голос — один победитель.', 120),
    ('dobryak-goda', 'Добряк года', 'Тот, кто согрел ITD без повода. Помощь, поддержка и добро, которое не просит лайков.', 130),
    ('interactive-goda', 'Интерактив года', 'Лучший совместный движ сообщества. Один голос за проект, который затянул сильнее всех.', 140),
    ('interview-goda', 'Интервьюер', 'Разговор, после которого захотелось думать. Один голос за интервьюера, который вытащил главное.', 150),
    ('photographer-goda', 'Фотограф года', 'Кадр, который стал воспоминанием. Свет, момент и взгляд, который сложно повторить.', 160),
    ('shitposter-goda', 'Шитпостер года', 'Смеёмся, но любим. Голос за того, чей абсурд держал сообщество на плаву весь год.', 170);

CREATE TEMP TABLE award_nominees (
    category_slug text NOT NULL REFERENCES award_catalog (slug),
    name text NOT NULL,
    description text NOT NULL,
    handle text,
    song text,
    image_url text,
    image_alt text,
    audio_url text,
    sort_order integer NOT NULL,
    PRIMARY KEY (category_slug, name)
) ON COMMIT DROP;

INSERT INTO award_nominees VALUES
    ('king-itd', 'ктсупер[113]', 'Держит внимание сообщества и задаёт тон в каждом эфире.', '@ktsuper113', NULL, '/assets/upstream/images/nominee-itdking.png', 'Портрет ктсупер[113] в чёрном костюме с золотой вышивкой в круглой золотой раме', NULL, 1),
    ('king-itd', 'Марк «MORPH» Ветров', 'Собрал вокруг себя полсообщества и никого не потерял.', '@morphcore', NULL, NULL, NULL, NULL, 2),
    ('king-itd', 'Даня Ноктюрн', 'Ночной голос ITD и автор главных тредов года.', '@nocturne', NULL, NULL, NULL, NULL, 3),
    ('king-itd', 'Алекс «Sable»', 'Архитектор движа, мемов и внезапных коллабов.', '@sable', NULL, NULL, NULL, NULL, 4),
    ('king-itd', 'Илья Орлов', 'Человек-эфир: всегда рядом, всегда с идеей.', '@orlov', NULL, NULL, NULL, NULL, 5),
    ('queen-itd', 'Зыска', 'Вкус, харизма и уверенность, которые задают тон.', '@zyska', NULL, '/assets/upstream/images/nominee-queen-zyska.png', 'Портрет Зыски с рыжими волосами в чёрном платье с золотой вышивкой в круглой раме', NULL, 1),
    ('queen-itd', 'Ева Мираж', 'Умеет превратить обычный вечер в событие.', '@eva_mirage', NULL, NULL, NULL, NULL, 2),
    ('queen-itd', 'Соня Вельвет', 'Вкус, тексты и бархатный голос сообщества.', '@velvetsonya', NULL, NULL, NULL, NULL, 3),
    ('queen-itd', 'Ника Астра', 'Харизма, после которой хочется остаться.', '@astra_nika', NULL, NULL, NULL, NULL, 4),
    ('queen-itd', 'Мила Рэй', 'Свет, ирония и очень точные мемы.', '@milaray', NULL, NULL, NULL, NULL, 5),
    ('ship-goda', 'Лиза × Артём', 'Самый тихий роман, который заметили все.', '#тихийшторм', NULL, NULL, NULL, NULL, 1),
    ('ship-goda', 'Кира × Макс', 'Неон, музыка и скриншоты на четыре тысячи реакций.', '#неонlove', NULL, NULL, NULL, NULL, 2),
    ('ship-goda', 'Ася × Ян', 'Две орбиты, которые наконец пересеклись.', '#двекометы', NULL, NULL, NULL, NULL, 3),
    ('ship-goda', 'Настя × Гриша', 'Делили всё пополам — даже внимание сообщества.', '#пополам', NULL, NULL, NULL, NULL, 4),
    ('artist-goda', 'Aquarelle Kid', 'Акварели, от которых пахнет летом и пылью.', '@aquarellekid', NULL, NULL, NULL, NULL, 1),
    ('artist-goda', 'LENA VOX', 'Смелые формы, громкие цвета и ни одного лишнего мазка.', '@lenavox', NULL, NULL, NULL, NULL, 2),
    ('artist-goda', 'Артём Небо', 'Рисует небо так, будто видел его изнутри.', '@neboart', NULL, NULL, NULL, NULL, 3),
    ('artist-goda', 'woolloomooloo', 'Тёплые персонажи и вселенная, в которую хочется вернуться.', '@wooloo', NULL, NULL, NULL, NULL, 4),
    ('meme-goda', '«Кот-админ»', 'Проверял заявки и стал главным мемом сезона.', '@cat_admin', NULL, '/assets/upstream/images/meme-kot-admin.svg', 'Серый кот в очках за рабочим столом с ноутбуком и тёплой лампой', NULL, 1),
    ('meme-goda', '«Ну это база»', 'Фраза, которая пережила все обсуждения.', '@nu_eto_baza', NULL, '/assets/upstream/images/meme-nu-eto-baza.svg', 'Рука ставит тяжёлую печать на стопку документов в луче света', NULL, 2),
    ('meme-goda', '«Ушёл в астрал»', 'Идеальный ответ на любой дедлайн.', '@astral_exit', NULL, '/assets/upstream/images/meme-astral-exit.svg', 'Силуэт человека в пальто уходит в светящийся фиолетовый портал', NULL, 3),
    ('meme-goda', '«Слоу-бро»', 'Реакция, которая работает быстрее всех.', '@slowbro', NULL, '/assets/upstream/images/meme-slowbro.svg', 'Ленивец в наушниках лежит в гамаке в тёмной комнате', NULL, 4),
    ('news-goda', 'ITD DAILY', 'Новости без воды, паники и лишних скобок.', '@itddaily', NULL, NULL, NULL, NULL, 1),
    ('news-goda', '«Шум и Ярость»', 'Громкий взгляд на тихие новости.', '@shum_i_yarost', NULL, NULL, NULL, NULL, 2),
    ('news-goda', '«Окно в ИТД»', 'Показывает то, что другие пропустили.', '@okno_itd', NULL, NULL, NULL, NULL, 3),
    ('news-goda', '«Сигнал / Noise»', 'Разбирает шум на смыслы каждое утро.', '@signalnoise', NULL, NULL, NULL, NULL, 4),
    ('streamer-goda', 'kira.exe', 'Эфиры, после которых хочется выспаться и повторить.', '@kira_exe', NULL, NULL, NULL, NULL, 1),
    ('streamer-goda', 'MOLCHUN', 'Молчит громче всех в чате.', '@molchun', NULL, NULL, NULL, NULL, 2),
    ('streamer-goda', 'tony_afterdark', 'После полуночи начинается его лучшее время.', '@tonyafterdark', NULL, NULL, NULL, NULL, 3),
    ('streamer-goda', 'dasha.live', 'Уютный лайв с музыкой, кофе и честными разговорами.', '@dashalive', NULL, NULL, NULL, NULL, 4),
    ('cosplay-goda', 'Jellyfish Queen', 'Костюм, который поплыл прямо в сердца.', '@jellyfishqueen', '«Глубина» — NEREID', NULL, NULL, NULL, 1),
    ('cosplay-goda', 'Cyber Baba', 'Бабушка с кибер-имплантами, которую мы не заслужили.', '@cyber_baba', '«Байт за байтом» — CYBERBABA', NULL, NULL, NULL, 2),
    ('cosplay-goda', 'Rina Cosplay', 'Точность в деталях и полное перевоплощение.', '@rinacos', '«Второй образ» — RINA', NULL, NULL, NULL, 3),
    ('cosplay-goda', 'HEXA', 'Шесть образов — один победитель?', '@hexacos', '«Шесть теней» — HEXA', NULL, NULL, NULL, 4),
    ('zavoz-goda', '«Неоновый завоз»', 'Привёз свет туда, где было слишком темно.', '@neon_import', NULL, '/assets/upstream/images/zavoz-neon-import.svg', 'Фургон с открытыми дверями и неоновым светом на ночной улице', NULL, 1),
    ('zavoz-goda', '«Коробка с сокровищами»', 'Внутри было всё, о чём вы просили в чате.', '@box_treasure', NULL, '/assets/upstream/images/zavoz-box-treasure.svg', 'Открытый деревянный ящик со светящимися сокровищами', NULL, 2),
    ('zavoz-goda', '«Маркет детектед»', 'Нашёл то, чего не было в наличии ни у кого.', '@marketdetected', NULL, '/assets/upstream/images/zavoz-market-detected.svg', 'Ночной маркет с редкими вещами и человеком с фонарём', NULL, 3),
    ('zavoz-goda', '«Вайб 2007»', 'Ностальгия, доставленная без задержек.', '@vibe2007', NULL, '/assets/upstream/images/zavoz-vibe-2007.svg', 'Комната с ЭЛТ-монитором, наушниками и закатным светом', NULL, 4),
    ('event-goda', 'ITD NIGHT 2026', 'Ночь, после которой чат не замолкал неделю.', '@itdnight', NULL, '/assets/upstream/images/event-itd-night.svg', 'Ночная вечеринка на крыше под гирляндами с танцующими силуэтами', NULL, 1),
    ('event-goda', '«Пиксель-фест»', 'Праздник для тех, кто вырос на кнопках.', '@pixelfest', NULL, '/assets/upstream/images/event-pixel-fest.svg', 'Фестиваль аркадных автоматов с неоновой подсветкой', NULL, 2),
    ('event-goda', '«Тихая вечеринка»', 'Танцевали даже те, кто пришёл просто посидеть.', '@quietparty', NULL, '/assets/upstream/images/event-quiet-party.svg', 'Тихая вечеринка в уютной комнате с тёплым светом', NULL, 3),
    ('event-goda', '«Арт-маркет у моря»', 'Море, крафт и очень много открыток.', '@artseamarket', NULL, '/assets/upstream/images/event-art-sea.svg', 'Арт-маркет у моря на закате с палатками и картинами', NULL, 4),
    ('project-goda', '«Подкаст без названия»', 'Голос, который включают на длинной дороге.', '@podcastnn', NULL, '/assets/upstream/images/project-podcast-nn.svg', 'Студия подкаста с двумя микрофонами и тёплым светом лампы', NULL, 1),
    ('project-goda', '«Клуб анонимных художников»', 'Место, где можно рисовать и не бояться.', '@anonymous_art', NULL, '/assets/upstream/images/project-anonymous-art.svg', 'Ночная художественная мастерская с мольбертами и холстами', NULL, 2),
    ('project-goda', 'ITD Wiki', 'Собрал историю сообщества в одном месте.', '@itdwiki', NULL, '/assets/upstream/images/project-itd-wiki.svg', 'Архив с картотекой и светящимся экраном, человек у стола', NULL, 3),
    ('project-goda', '«Свет в окне»', 'Проект, после которого стало чуть теплее.', '@svet_v_okne', NULL, '/assets/upstream/images/project-svet-okne.svg', 'Тёмный фасад дома с одним тёплым светящимся окном', NULL, 4),
    ('track-goda', '«Северный шум» — Lowkey Lera', 'Гимн тех, кто едет домой в последнем вагоне.', '@lowkeylera', NULL, NULL, NULL, '/assets/upstream/audio/northern-noise.wav', 1),
    ('track-goda', '«Пыль» — VHS Dream', 'Ностальгия на скорости 33 оборота.', '@vhsdream', NULL, NULL, NULL, '/assets/upstream/audio/dust-vhs.wav', 2),
    ('track-goda', '«Не отпускай» — miro', 'Припев, который остаётся на весь день.', '@miromusic', NULL, NULL, NULL, '/assets/upstream/audio/dont-let-go.wav', 3),
    ('track-goda', '«Тишина в сети» — No Signal', 'Тихий трек с очень громким послевкусием.', '@nosignal', NULL, NULL, NULL, '/assets/upstream/audio/silence-online.wav', 4),
    ('track-goda', '«Медленно» — рассвет', 'Для моментов, когда спешить уже некуда.', '@rassvet', NULL, NULL, NULL, '/assets/upstream/audio/slowly.wav', 5),
    ('dobryak-goda', 'Маша «плюс один»', 'Всегда добавит тебя в список, даже если список закрыт.', '@plus_one', NULL, NULL, NULL, NULL, 1),
    ('dobryak-goda', 'Костя Фонарь', 'Подсвечивает путь без лишних слов.', '@kostya_lantern', NULL, NULL, NULL, NULL, 2),
    ('dobryak-goda', 'Аня «чай»', 'Заливает чай и вытаскивает из плохого дня.', '@anya_tea', NULL, NULL, NULL, NULL, 3),
    ('dobryak-goda', 'Dr. Hug', 'Официально не врач, но лечит лучше многих.', '@dr_hug', NULL, NULL, NULL, NULL, 4),
    ('interactive-goda', '«Тихий чат»', 'Место, где можно молчать вместе.', '@quietchat', NULL, NULL, NULL, NULL, 1),
    ('interactive-goda', '«Штаб ITD»', 'Координация, которая выглядела как магия.', '@itdhq', NULL, NULL, NULL, NULL, 2),
    ('interactive-goda', '«Мем-фабрика»', 'Производство смеха без выходных.', '@memfactory', NULL, NULL, NULL, NULL, 3),
    ('interactive-goda', '«Фотоохота»', 'Заставил всех смотреть по сторонам.', '@photohunt', NULL, NULL, NULL, NULL, 4),
    ('interactive-goda', '«Голосовалка»', 'Спортивный интерес в чистом виде.', '@votingclub', NULL, NULL, NULL, NULL, 5),
    ('interview-goda', '«После полуночи»', 'Разговоры, которые не помещаются в таймкод.', '@aftermidnight', NULL, NULL, NULL, NULL, 1),
    ('interview-goda', '«Неудобные вопросы»', 'Спрашивает то, что другие постеснялись.', '@hardquestions', NULL, NULL, NULL, NULL, 2),
    ('interview-goda', '«С глазу на глаз»', 'Тихо, честно и без подготовки.', '@eye2eye', NULL, NULL, NULL, NULL, 3),
    ('interview-goda', '«Честно говоря»', 'Интервью, после которых меняют мнение.', '@honestly', NULL, NULL, NULL, NULL, 4),
    ('interview-goda', '«Комната 404»', 'Там, где находят друг друга.', '@room404', NULL, NULL, NULL, NULL, 5),
    ('photographer-goda', 'Лиза Свет', 'Ловит свет там, где остальные видят тень.', '@lizasvet', NULL, NULL, NULL, NULL, 1),
    ('photographer-goda', 'Кадр №7', 'Седьмой кадр всегда оказывается главным.', '@frame7', NULL, NULL, NULL, NULL, 2),
    ('photographer-goda', 'Миша Тень', 'Тёмные кадры с очень светлым смыслом.', '@mishaten', NULL, NULL, NULL, NULL, 3),
    ('photographer-goda', 'Glow.exe', 'Пересвет как художественный приём.', '@glowexe', NULL, NULL, NULL, NULL, 4),
    ('shitposter-goda', 'shitpost.daily', 'Поставляет абсурд в промышленных масштабах.', '@shitpostdaily', NULL, NULL, NULL, NULL, 1),
    ('shitposter-goda', '«Мемный дед»', 'Видел все мемы до того, как они стали мемами.', '@memded', NULL, NULL, NULL, NULL, 2),
    ('shitposter-goda', '«Паблик, который устал»', 'Устал, но продолжает.', '@tiredpublic', NULL, NULL, NULL, NULL, 3),
    ('shitposter-goda', '«Токсичный позитив»', 'Улыбается так, что становится не по себе.', '@toxicpositive', NULL, NULL, NULL, NULL, 4);

INSERT INTO nominations (title, description, status, sort_order)
SELECT c.title, c.description, 'open', c.sort_order
FROM award_catalog c
WHERE NOT EXISTS (
    SELECT 1 FROM nominations n WHERE n.title = c.title AND NOT n.archived AND NOT n.suggestions_preview
)
ORDER BY c.sort_order;

INSERT INTO nominees (nomination_id, name, description, handle, song, image_url, image_alt, audio_url, sort_order)
SELECT n.id, entry.name, entry.description, entry.handle, entry.song,
    entry.image_url, entry.image_alt, entry.audio_url, entry.sort_order
FROM award_nominees entry
JOIN award_catalog c ON c.slug = entry.category_slug
JOIN LATERAL (
    SELECT id FROM nominations
    WHERE title = c.title AND NOT archived AND NOT suggestions_preview
    ORDER BY id LIMIT 1
) n ON true
WHERE NOT EXISTS (
    SELECT 1 FROM nominees m WHERE m.nomination_id = n.id AND m.name = entry.name
)
ORDER BY c.sort_order, entry.sort_order;
