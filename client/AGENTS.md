# Client

Frontend премии ITD AWARDS 2026.

- Стек: React 19, TypeScript, Vite 8, React Router 7, lucide-react.
- Публичные страницы: `src/pages/`, компоненты: `src/components/`, стили: `src/styles.css`.
- Админка `/admin` и страница `/account` — отдельные HTML/CSS/JS в `admin/`, не React.
- Команды из каталога `client`: `npm run dev` (Vite, порт 5173), `npm run build` (`tsc -b && vite build`), `npm run lint` (oxlint).
- Vite проксирует `/api`, `/assets`, `/admin`, `/account`, `/control` на `http://127.0.0.1:5000`; для другого порта задайте `API_PORT`.
- При работе с репозиторием использовать ветку `feature/client`, не `main`. Изменения только внутри `client/`.
