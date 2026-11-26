export async function mockFirebaseCDN(page, initialDbData = null) {
  await page.route('https://www.gstatic.com/firebasejs/**', async (route) => {
    const url = route.request().url();

    if (url.includes('firebase-app.js')) {
      return route.fulfill({
        contentType: 'application/javascript',
        body: `
          window.__MOCK_FB__ = window.__MOCK_FB__ || {
            user: null,
            authListeners: [],
            dbListeners: [],
            data: ${JSON.stringify(initialDbData || {
              contas: {
                c1: { nome: 'Nubank', saldoInicial: 1000 },
                c2: { nome: 'Carteira', saldoInicial: 200 }
              },
              transacoes: {},
              emprestimos: {},
              pagamentosEmprestimo: {},
              atalhos: {
                a1: { emoji: '🥖', nome: 'Padaria', categoria: 'Alimentação' }
              }
            })}
          };
          export function initializeApp(config) { return { config }; }
          export function getApp() { return {}; }
        `,
      });
    }

    if (url.includes('firebase-auth.js')) {
      return route.fulfill({
        contentType: 'application/javascript',
        body: `
          const notifyAuth = () => {
            const fb = window.__MOCK_FB__;
            fb.authListeners.forEach((cb) => cb(fb.user));
          };
          export const browserLocalPersistence = {};
          export function getAuth() { return {}; }
          export function setPersistence() { return Promise.resolve(); }
          export function onAuthStateChanged(_auth, cb) {
            window.__MOCK_FB__.authListeners.push(cb);
            setTimeout(() => cb(window.__MOCK_FB__.user), 0);
            return () => {};
          }
          export async function signInWithEmailAndPassword(_auth, email, senha) {
            if (!email.includes('@') || senha.length < 4) {
              const err = new Error('auth/invalid-credential');
              err.code = 'auth/invalid-credential';
              throw err;
            }
            window.__MOCK_FB__.user = { uid: 'uid-teste-123', email };
            notifyAuth();
            return { user: window.__MOCK_FB__.user };
          }
          export async function createUserWithEmailAndPassword(_auth, email) {
            window.__MOCK_FB__.user = { uid: 'uid-teste-123', email };
            notifyAuth();
            return { user: window.__MOCK_FB__.user };
          }
          export async function signOut() {
            window.__MOCK_FB__.user = null;
            notifyAuth();
          }
          export async function sendPasswordResetEmail() { return Promise.resolve(); }
        `,
      });
    }

    if (url.includes('firebase-database.js')) {
      return route.fulfill({
        contentType: 'application/javascript',
        body: `
          const getByPath = (obj, path) => {
            const parts = path.replace(/^usuarios\\/[^/]+\\/?/, '').split('/').filter(Boolean);
            return parts.reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), obj);
          };
          const setByPath = (obj, path, value) => {
            const parts = path.replace(/^usuarios\\/[^/]+\\/?/, '').split('/').filter(Boolean);
            if (!parts.length) {
              Object.keys(obj).forEach((k) => delete obj[k]);
              Object.assign(obj, value || {});
              return;
            }
            let cur = obj;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
              cur = cur[parts[i]];
            }
            const last = parts[parts.length - 1];
            if (value === null) delete cur[last];
            else cur[last] = value;
          };
          const notifyDb = () => {
            const fb = window.__MOCK_FB__;
            fb.dbListeners.forEach(({ path, cb }) => {
              const val = getByPath(fb.data, path);
              cb({ val: () => structuredClone(val) });
            });
          };
          export function getDatabase() { return {}; }
          export function ref(_db, path = '') { return { path }; }
          export function onValue(r, cb) {
            window.__MOCK_FB__.dbListeners.push({ path: r.path, cb });
            const val = getByPath(window.__MOCK_FB__.data, r.path);
            setTimeout(() => cb({ val: () => structuredClone(val) }), 0);
            return () => {};
          }
          export async function set(r, value) {
            setByPath(window.__MOCK_FB__.data, r.path, structuredClone(value));
            notifyDb();
          }
          export async function update(r, updates) {
            const base = r.path ? r.path + '/' : '';
            Object.entries(updates).forEach(([k, v]) => {
              setByPath(window.__MOCK_FB__.data, base + k, structuredClone(v));
            });
            notifyDb();
          }
        `,
      });
    }

    return route.abort();
  });
}

export async function loginEPularPin(page, email = 'gilmar@teste.com', senha = '123456') {
  await page.goto('/');
  await page.fill('#authEmail', email);
  await page.fill('#authSenha', senha);
  await page.click('#authBtn');

  const pinOverlay = page.locator('#pinOverlay');
  await pinOverlay.waitFor({ state: 'visible' });
  const btnPular = page.locator('#pinPular');
  if (await btnPular.isVisible()) {
    await btnPular.click();
  }
  await pinOverlay.waitFor({ state: 'hidden' });
}