-- Archive the exact demo ballots, retaining their candidates and votes.
UPDATE nominations n
SET archived = true, status = 'closed'
FROM (VALUES
    ('KING ITD', ARRAY['Участник А', 'Участник Б', 'Участник В']),
    ('Ивент года', ARRAY['Событие А', 'Событие Б']),
    ('Сквад года', ARRAY['Команда А', 'Команда Б']),
    ('Баннер года', ARRAY['Работа А', 'Работа Б']),
    ('Интервью года', ARRAY['Беседа А', 'Беседа Б'])
) AS demo(title, names)
WHERE n.title = demo.title AND NOT n.archived AND NOT n.suggestions_preview
    AND ARRAY(SELECT name FROM nominees WHERE nomination_id = n.id ORDER BY sort_order, id) = demo.names;

CREATE TEMP TABLE award_catalog (
    title text PRIMARY KEY,
    description text NOT NULL,
    sort_order integer NOT NULL,
    names text[] NOT NULL
) ON COMMIT DROP;

INSERT INTO award_catalog (title, description, sort_order, names) VALUES
    ('KING ITD', 'Главная номинация премии. Отметьте того, кто запомнился сообществу больше всех.', 10,
     ARRAY['Ктсупер', 'Никита Аэро', 'Аббас', 'Тихая Тоска', 'Друзьяшка', 'Сэм', 'Skorlange', 'Бадик', 'Gatosich', 'Снейр']),
    ('QUEEN ITD', 'Кого сообщество выберет королевой ИТД?', 20,
     ARRAY['Зыска', 'Вика Вилка', 'Херока', 'Меок', 'Дреграв', 'Нарко', 'Kisssa', 'Аля', 'Емае', 'Дашуша', 'Японка Вич']),
    ('Шип года', 'Выберите пару, которая запомнилась сообществу.', 30,
     ARRAY['зыска и херока', 'марура и сахар', 'Аббас и нарко', 'improfire и ranpard', 'вика вилка и никарончик', 'икстаузар и линчик', 'мявк и тихая тоска', 'пилозар и бабл', 'аэро и эка', 'емае и зерно', 'радан и бадя', 'соня и итдстатус']),
    ('Художник года', 'Выберите художника, чьи работы запомнились вам в этом году.', 40,
     ARRAY['херока', 'кафтаняш', 'Яна вирдоу', 'винси', 'василини', 'олесок', 'муфи мухомор', 'ванна', 'мерша', 'юзилис сноумэн', 'ladnokay', 'd123']),
    ('Мем года', 'Выберите мем, который запомнился вам в этом году.', 50,
     ARRAY['чикенбурбе', '🔥василини призналась', 'ИТД 2024', 'Барни', 'хы блы', 'Сливки', 'Ого', 'Тигр', 'Николай21', 'Остановсися', 'мем с Кунжутом', 'беременный новки']);

INSERT INTO nominations (title, description, status, sort_order)
SELECT c.title, c.description, 'open', c.sort_order
FROM award_catalog c
WHERE NOT EXISTS (
    SELECT 1 FROM nominations n WHERE n.title = c.title AND NOT n.archived AND NOT n.suggestions_preview
)
ORDER BY c.sort_order;

INSERT INTO nominees (nomination_id, name, sort_order)
SELECT n.id, candidate.name, candidate.position
FROM award_catalog c
JOIN nominations n ON n.title = c.title AND NOT n.archived AND NOT n.suggestions_preview
CROSS JOIN LATERAL unnest(c.names) WITH ORDINALITY AS candidate(name, position)
WHERE NOT EXISTS (
    SELECT 1 FROM nominees m WHERE m.nomination_id = n.id AND m.name = candidate.name
)
ORDER BY c.sort_order, candidate.position;
