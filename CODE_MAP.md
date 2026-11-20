# Карта кода ITD Awards

| Что хочу изменить | Где находится | Какая функция |
| --- | --- | --- |
| Выдача кода Telegram | `server/modules/auth/telegramAuth.js` | `issueCode` |
| Единый вход по коду | `server/modules/auth/authController.js` | `login` |
| Хранение и погашение кода | `server/modules/auth/loginCodes.js` | `storeLoginCode`, `consumeLoginCode` |
| Создание, повторная выдача и отзыв приглашений | `server/modules/auth/invitations.js` | `createInvitation`, `reissueInvitation`, `revokeInvitation` |
| Сессии, cookie и проверка ролей | `server/modules/auth/sessions.js` | `saveSession`, `setSession`, `readSession`, `requireRole` |
| Поиск пользователя, блокировка и изменение роли | `server/modules/users/usersController.js` | `listUsers`, `getUser`, `updateUser` |
| Выдача публичных номинаций и номинантов | `server/modules/awards/catalog.js` | `getNominations`, `getNominees` |
| Создание номинации, редактирование и архивирование номинанта | `server/modules/awards/adminCatalog.js` | `createNomination`, `createNominee`, `updateNominee` |
| Импорт, экспорт и массовые правки каталога | `server/modules/awards/adminCatalog.js` | `importCatalog`, `exportCatalog`, `bulkEditCatalog` |
| Загрузка изображения | `server/modules/awards/images.js` | `uploadCatalogImage` |
| Приём и повторная подача голоса | `server/modules/voting/ballots.js` | `postVote`, `saveVote` |
| Расписание и публикация результатов | `server/modules/voting/settings.js` | `updateSettings` |
| Подсчёт и выгрузка результатов | `server/modules/voting/results.js` | `getResults`, `exportResultsCsv` |
| Статистика, привилегированные инструменты и аудит | `server/modules/admin/` | `getStats`, `readTable`, `getAudit` |
| Статус Telegram и PostgreSQL, состояние сервисов | `server/modules/monitoring/system.js` | `botHeartbeat`, `readSystemStatus` |
| Страницы и серверная защита админки | `server/modules/pages/pagesController.js` | `serveAdminPage`, `serveAccountPage`, `servePublicPage` |
| Команды Telegram `/start`, `/login`, `/newcode` | `bot/modules/auth/handlers.py` | `register`, `show_code` |
| Запрос к Express и обработка ответа в боте | `bot/modules/auth/site_api.py` | `request_login_code` |
| Настройка логов и маскирование секретов бота | `bot/app/logging_setup.py` | `configure`, `mask` |

`server.js` проверяет PostgreSQL и запускает Express. `app.js` подключает общие middleware, API и страницы. Например, `POST /api/votes` попадает из `routes/api.js` в `modules/voting/votingRoutes.js`. Middleware проверяют сессию и лимиты, затем `postVote` валидирует идентификаторы и вызывает `saveVote` внутри транзакции из `database/db.js`. Обработчик возвращает прежний HTTP-ответ.

Админские URL собраны в `modules/admin/adminRoutes.js`. Обработчики каталога, пользователей и голосования живут в своих модулях. `runAdminChange` повторно проверяет права под блокировкой и объединяет изменение с записью в аудит.

Активный бот запускается через `bot/main.py` и запрашивает код у Express. Источник аккаунтов, ролей и кодов — PostgreSQL сайта. Автономный бот, его SQLite-код и консоль находятся в `tash/bot/`.
