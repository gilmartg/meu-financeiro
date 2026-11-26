const CACHE_NAME = 'financas-pwa-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/config.js',
  './js/utils.js',
  './js/core/store.js',
  './js/core/firebase.js',
  './js/core/auth.js',
  './js/core/inatividade.js',
  './js/ui/dom.js',
  './js/ui/acoes.js',
  './js/ui/render.js',
  './js/features/transacoes.js',
  './js/features/contas.js',
  './js/features/emprestimos.js',
  './js/features/atalhos.js',
  './js/features/voz.js',
  './js/features/graficos.js',
  './js/features/backup.js'
];

// Instala e salva os arquivos no celular
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Intercepta as requisições
self.addEventListener('fetch', (event) => {
  // Não guarda em cache as chamadas do Firebase ou do Google
  if (event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic')) {
    return;
  }

  // Tenta pegar do cache, se não tiver, busca na internet
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Atualiza o cache quando mudar a versão
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
});