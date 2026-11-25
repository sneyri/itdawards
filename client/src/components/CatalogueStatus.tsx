export function CatalogueStatus({ error, reload }: { error?: Error; reload: () => Promise<void> }) {
  return (
    <div className="container section">
      <div className="empty-state" role={error ? 'alert' : 'status'}>
        <h2>{error ? 'Не удалось загрузить номинации' : 'Загружаем номинации…'}</h2>
        {error && <>
          <p>{error.message}</p>
          <button type="button" className="button button--gold" onClick={() => void reload()}>Повторить</button>
        </>}
      </div>
    </div>
  )
}
