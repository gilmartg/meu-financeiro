const CACHE_NAME = 'financas-pwa-v3'; // Atualizei para v3 para forçar a atualização
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/config.js',
  './js/utils.js',
  './js/core/store.js',
  './js/core/firebase.js',
  './js/core/acoes.js',
  './js/core/auth.js',
  './js/core/inatividade.js',
  './js/ui/dom.js',
  './js/ui/render.js',
  './js/ui/modal.js',
  './js/ui/tabs.js',
  './js/features/auth.js',
  './js/features/pin.js',
  './js/features/sessao.js',
  './js/features/contas.js',
  './js/features/transacoes.js',
  './js/features/atalhos.js',
  './js/features/emprestimos.js',
  './js/features/voz.js',
  './js/features/graficos.js',
  './js/features/backup.js',
  './js/features/painel.js',
  './manifest.json'
];

// Instala salvando arquivo por arquivo (se um falhar, não quebra o resto)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS.map((url) => {
          return cache.add(url).catch((err) => {
            console.warn('⚠️ Arquivo não cacheado (pode não existir):', url);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

// Ativa e limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercepta requisições
self.addEventListener('fetch', (event) => {
  // Ignora Firebase e APIs externas
  if (event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic')) {
    return;
  }

  // Estratégia: Tenta a rede, se falhar (offline), tenta o cache
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((response) => {
        // Se for uma navegação (ex: abrir o app), retorna o index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return response;
      });
    })
  );
});