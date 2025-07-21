import init from "../../../wasm/pkg/cps_lib.js";

export const wasmReady = init().then(
  () => {
    console.log("WASM initialized successfully");
  },
  (error) => {
    console.error("WASM initialization failed:", error);
    if (import.meta.env.VITEST) {
      // Vitest does not currently support WASM, so we just ignore the error
      return;
    }

    throw error;
  },
);
