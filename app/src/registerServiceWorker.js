let registrationAttempted = false;

async function cleanupStaleServiceWorkers(runtime) {
  const nav = runtime.navigatorRef;
  const cacheStorage = runtime.cacheStorageRef;

  try {
    const registrations = await nav.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (error) {
    console.warn("RSOS dev cleanup could not unregister service workers", error);
  }

  if (!cacheStorage) return;

  try {
    const names = await cacheStorage.keys();
    await Promise.all(
      names
        .filter((name) => String(name).startsWith("rsos-"))
        .map((name) => cacheStorage.delete(name)),
    );
  } catch (error) {
    console.warn("RSOS dev cleanup could not clear caches", error);
  }
}

function resolveRuntime(overrides = {}) {
  const windowRef = overrides.windowRef || (typeof window !== "undefined" ? window : null);
  const navigatorRef = overrides.navigatorRef || (typeof navigator !== "undefined" ? navigator : null);
  const cacheStorageRef = overrides.cacheStorageRef || (typeof caches !== "undefined" ? caches : null);
  const hasViteClient = Boolean(
    windowRef?.document?.querySelector?.('script[type="module"][src*="/@vite/client"]'),
  );
  const isDevelopment = typeof overrides.isDevelopment === "boolean"
    ? overrides.isDevelopment
    : Boolean(import.meta?.env?.DEV || hasViteClient);

  return {
    windowRef,
    navigatorRef,
    cacheStorageRef,
    isDevelopment,
  };
}

export function registerRsosServiceWorker(overrides = {}) {
  if (registrationAttempted) return;
  registrationAttempted = true;

  const runtime = resolveRuntime(overrides);

  if (!runtime.windowRef || !runtime.navigatorRef || !("serviceWorker" in runtime.navigatorRef)) return;

  if (runtime.isDevelopment) {
    runtime.windowRef.addEventListener("load", async () => {
      await cleanupStaleServiceWorkers(runtime).catch(() => undefined);
    });
    return;
  }

  runtime.windowRef.addEventListener("load", async () => {
    try {
      const registration = await runtime.navigatorRef.serviceWorker.register("/sw.js", { scope: "/" });

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && runtime.navigatorRef.serviceWorker.controller) {
            runtime.windowRef.dispatchEvent(new Event("rsos-sw-update-available"));
          }
        });
      });
    } catch (error) {
      console.error("RSOS service worker registration failed", error);
    }
  });
}

export function __resetSwRegistrationForTests() {
  registrationAttempted = false;
}
