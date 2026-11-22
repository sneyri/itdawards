# Client

Frontend премии ITD AWARDS 2026.

- Стек: React 19, TypeScript, Vite 8, React Router 7, lucide-react.
- Публичные страницы: `src/pages/`, компоненты: `src/components/`, стили: `src/styles.css`.
- Админка `/admin` и страница `/account` — отдельные HTML/CSS/JS в `admin/`, не React.
- Команды из каталога `client`: `npm run dev` (Vite, порт 5173), `npm run build` (`tsc -b && vite build`), `npm run lint` (oxlint).
- Vite проксирует `/api`, `/assets`, `/admin`, `/account`, `/control` на `http://127.0.0.1:5000`; для другого порта задайте `API_PORT`, для внешнего API — `API_URL`. Запись (`POST/PATCH/PUT/DELETE` на `/api`) в локальном режиме заблокирована.
- Service worker в `public/sw.js` кэширует только изображения same-origin в Cache Storage `itd-images-v1`; аудио постепенно подгружается в `itd-audio-v1` через `src/lib/mediaPrefetch.ts` после загрузки каталога.
- При работе с репозиторием использовать ветку `feature/client`, не `main`. Изменения только внутри `client/`.
