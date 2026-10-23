export function storageFor(id: string, revision: string, base: string) {
  const key = `web-estudio:${base}:${id}`;
  return {
    read(): unknown { try { const data = JSON.parse(localStorage.getItem(key) || 'null'); return data?.revision === revision ? data.value : null; } catch { return null; } },
    write(value: unknown) { try { localStorage.setItem(key, JSON.stringify({ revision, value })); } catch { /* Practice continues in memory. */ } },
    reset() { try { localStorage.removeItem(key); } catch { /* No storage is required. */ } },
  };
}
