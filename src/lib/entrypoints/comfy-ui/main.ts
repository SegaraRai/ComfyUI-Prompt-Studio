import {
  app as comfyUIApp,
  type LGraphNode,
} from "virtual:comfy-ui/scripts/app.js";
import { stripComments } from "../../core/comment.js";
import { init, waitBackendReady } from "./factory.js";
import { getAvailableModels } from "./resources.js";

const BOOT_TIMEOUT = 10_000; // 10 seconds
const BOOT_POLL_INTERVAL = 200; // 200 ms

const CLIENT_ID = `cps_${crypto.randomUUID()}`;

comfyUIApp.registerExtension({
  name: "prompt-studio",
  async setup() {
    if (!(await waitBackendReady(BOOT_TIMEOUT, BOOT_POLL_INTERVAL))) {
      throw new Error("Backend is not ready after 10 seconds");
    }

    const models = await getAvailableModels();

    const app = init(CLIENT_ID);

    app.setResourceDefinition({
      embeddings: models.embeddings.map((name) => ({
        type: "embedding",
        name,
      })),
      loras: models.loras.map((name) => ({
        type: "lora",
        name,
      })),
    });
  },
});

// Strip comments before sending to the backend for known nodes

const STRIP_COMMENTS_NODE_WIDGETS_MAP: Partial<
  Readonly<Record<string, readonly string[]>>
> = {
  "easy fullLoader": ["positive", "negative"],
  "easy a1111Loader": ["positive", "negative"],
  "easy comfyLoader": ["positive", "negative"],
  "easy cascadeLoader": ["positive", "negative"],
  "easy kolorsLoader": ["positive", "negative"],
  "easy fluxLoader": ["positive"],
  "easy hunyuanDiTLoader": ["positive", "negative"],
  "easy pixArtLoader": ["positive", "negative"],
  "easy mochiLoader": ["positive", "negative"],
};

const seenNodeSet = new WeakSet<LGraphNode>();

comfyUIApp.registerExtension({
  name: "prompt-studio-strip-comments",
  loadedGraphNode(node): void {
    // Since the `nodeCreated` hook does not have type information yet,
    // we need to process it in the `loadedGraphNode` hook

    // Prevent processing the same node multiple times
    if (seenNodeSet.has(node)) {
      return;
    }
    seenNodeSet.add(node);

    const widgetNames = STRIP_COMMENTS_NODE_WIDGETS_MAP[node.type];
    if (!widgetNames) {
      return;
    }

    for (const widget of node.widgets ?? []) {
      if (!widgetNames.includes(widget.name)) {
        continue;
      }

      console.log(
        `Stripping comments from widget ${widget.name} in node ${node.type}`,
      );

      widget.serializeValue = (): unknown => {
        if (typeof widget.value !== "string") {
          return widget.value;
        }

        return stripComments(widget.value);
      };
    }
  },
});
