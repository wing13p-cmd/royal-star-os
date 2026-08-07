import test from "node:test";
import assert from "node:assert/strict";
import { __resetSwRegistrationForTests, registerRsosServiceWorker } from "./registerServiceWorker.js";

function createWindowHarness() {
  const listeners = new Map();
  const dispatchedEvents = [];
  const windowObj = {
    addEventListener: (type, callback) => {
      listeners.set(type, callback);
    },
    dispatchEvent: (event) => {
      dispatchedEvents.push(event.type);
      return true;
    },
    Event: class Event {
      constructor(type) {
        this.type = type;
      }
    },
  };

  const workerListeners = new Map();
  const installingWorker = {
    state: "installing",
    addEventListener: (type, callback) => workerListeners.set(type, callback),
  };

  const registrationListeners = new Map();
  const registration = {
    installing: installingWorker,
    addEventListener: (type, callback) => registrationListeners.set(type, callback),
  };

  let registerCalls = 0;
  let unregisterCalls = 0;
  const navigatorObj = {
    serviceWorker: {
      controller: {},
      register: async () => {
        registerCalls += 1;
        return registration;
      },
      getRegistrations: async () => [
        {
          unregister: async () => {
            unregisterCalls += 1;
            return true;
          },
        },
      ],
    },
  };

  const deletedCaches = [];
  const cacheStorage = {
    keys: async () => ["rsos-app-shell-v2-20260806", "rsos-static-v2-20260806", "other-cache"],
    delete: async (name) => {
      deletedCaches.push(name);
      return true;
    },
  };

  return {
    windowObj,
    navigatorObj,
    cacheStorage,
    listeners,
    dispatchedEvents,
    registrationListeners,
    workerListeners,
    installingWorker,
    getRegisterCalls: () => registerCalls,
    getUnregisterCalls: () => unregisterCalls,
    getDeletedCaches: () => deletedCaches,
  };
}

test("service worker registration is idempotent", async () => {
  __resetSwRegistrationForTests();
  const harness = createWindowHarness();

  Object.defineProperty(globalThis, "window", { value: harness.windowObj, configurable: true, writable: true });
  Object.defineProperty(globalThis, "navigator", { value: harness.navigatorObj, configurable: true, writable: true });
  Object.defineProperty(globalThis, "Event", { value: harness.windowObj.Event, configurable: true, writable: true });

  registerRsosServiceWorker();
  registerRsosServiceWorker();

  assert.equal(harness.listeners.has("load"), true);
  await harness.listeners.get("load")();
  assert.equal(harness.getRegisterCalls(), 1);
});

test("update flow dispatches rsos-sw-update-available event", async () => {
  __resetSwRegistrationForTests();
  const harness = createWindowHarness();

  Object.defineProperty(globalThis, "window", { value: harness.windowObj, configurable: true, writable: true });
  Object.defineProperty(globalThis, "navigator", { value: harness.navigatorObj, configurable: true, writable: true });
  Object.defineProperty(globalThis, "Event", { value: harness.windowObj.Event, configurable: true, writable: true });

  registerRsosServiceWorker();
  await harness.listeners.get("load")();

  harness.registrationListeners.get("updatefound")();
  harness.installingWorker.state = "installed";
  harness.workerListeners.get("statechange")();

  assert.equal(harness.dispatchedEvents.includes("rsos-sw-update-available"), true);
});

test("development mode cleans stale service workers and rsos caches without registering", async () => {
  __resetSwRegistrationForTests();
  const harness = createWindowHarness();

  Object.defineProperty(globalThis, "window", { value: harness.windowObj, configurable: true, writable: true });
  Object.defineProperty(globalThis, "navigator", { value: harness.navigatorObj, configurable: true, writable: true });

  registerRsosServiceWorker({
    isDevelopment: true,
    windowRef: harness.windowObj,
    navigatorRef: harness.navigatorObj,
    cacheStorageRef: harness.cacheStorage,
  });

  await harness.listeners.get("load")();

  assert.equal(harness.getRegisterCalls(), 0);
  assert.equal(harness.getUnregisterCalls(), 1);
  assert.deepEqual(harness.getDeletedCaches().sort(), [
    "rsos-app-shell-v2-20260806",
    "rsos-static-v2-20260806",
  ]);
});
