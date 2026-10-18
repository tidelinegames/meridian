// Browser helpers shared by the exported game and the loader.
(function () {
  const scope = new URL('./', location.href).href;
  const cachePrefix = 'Meridian-sw-cache-' + encodeURIComponent(new URL(scope).pathname) + '-';
  window.MeridianWeb = {
    scope,
    cachePrefix,
    async recover() {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration(scope) : null;
      if (reg && reg.scope === scope) {
        const worker = reg.active || reg.waiting || reg.installing;
        if (worker && worker.scriptURL === new URL('index.service.worker.js', scope).href) await reg.unregister();
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k.startsWith(cachePrefix)).map(k => caches.delete(k)));
      }
    }
  };
  window.MeridianFiles = {
    choose(callback) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', async () => {
        try {
          if (input.files.length) callback(await input.files[0].text());
        } finally { input.remove(); }
      }, {once: true});
      input.addEventListener('cancel', () => input.remove(), {once: true});
      input.click();
    }
  };
})();
