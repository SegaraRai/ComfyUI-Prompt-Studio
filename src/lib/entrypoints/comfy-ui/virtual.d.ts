declare module "virtual:comfy-ui/scripts/app.js" {
  export type LGraph = import("@comfyorg/litegraph/dist/LGraph").LGraph;
  export type LGraphCanvas =
    import("@comfyorg/litegraph/dist/LGraphCanvas").LGraphCanvas;
  export type LGraphNode =
    import("@comfyorg/litegraph/dist/LGraphNode").LGraphNode;

  export interface KeyCombo {
    key: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  }

  export interface Keybinding {
    commandId: string;
    combo: KeyCombo;
    targetElementId?: string;
  }

  export interface AboutPageBadge {
    label: string;
    url: string;
    icon: string;
  }

  export type SettingParams = unknown;
  export type BottomPanelExtension = unknown;
  export type ComfyCommand = unknown;

  export type MenuCommandGroup = {
    /**
     * The path to the menu group.
     */
    path: string[];
    /**
     * Command ids.
     * Note: Commands must be defined in `commands` array in the extension.
     */
    commands: string[];
  };

  // https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/types/comfy.ts
  export interface ComfyExtension {
    /**
     * The name of the extension
     */
    name: string;

    /**
     * The commands defined by the extension
     */
    commands?: ComfyCommand[];

    /**
     * The keybindings defined by the extension
     */
    keybindings?: Keybinding[];

    /**
     * Menu commands to add to the menu bar
     */
    menuCommands?: MenuCommandGroup[];

    /**
     * Settings to add to the settings menu
     */
    settings?: SettingParams[];

    /**
     * Bottom panel tabs to add to the bottom panel
     */
    bottomPanelTabs?: BottomPanelExtension[];

    /**
     * Badges to add to the about page
     */
    aboutPageBadges?: AboutPageBadge[];

    /**
     * Allows any initialisation, e.g. loading resources. Called after the canvas is created but before nodes are added
     * @param app The ComfyUI app instance
     */
    init?(app: ComfyApp): Promise<void> | void;

    /**
     * Allows any additional setup, called after the application is fully set up and running
     * @param app The ComfyUI app instance
     */
    setup?(app: ComfyApp): Promise<void> | void;

    /**
     * Allows the extension to modify a node that has been reloaded onto the graph.
     * If you break something in the backend and want to patch workflows in the frontend
     * This is the place to do this
     * @param node The node that has been loaded
     * @param app The ComfyUI app instance
     */
    loadedGraphNode?(node: LGraphNode, app: ComfyApp): void;

    /**
     * Allows the extension to run code after the constructor of the node
     * @param node The node that has been created
     * @param app The ComfyUI app instance
     */
    nodeCreated?(node: LGraphNode, app: ComfyApp): void;
  }

  // https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/scripts/app.ts
  export interface ComfyUIApp {
    readonly canvas: LGraphCanvas;
    readonly canvasEl: HTMLCanvasElement;
    readonly graph: LGraph;

    registerExtension(extension: ComfyExtension): void;
  }

  export const app: ComfyUIApp;
}

declare module "virtual:comfy-ui/scripts/api.js" {
  export interface ComfyApi {
    fetchApi(route: string, options?: RequestInit): Promise<Response>;

    addEventListener<TEvent extends keyof ApiEvents>(
      type: TEvent,
      callback: ((event: ApiEvents[TEvent]) => void) | null,
      options?: AddEventListenerOptions | boolean,
    ): void;

    removeEventListener<TEvent extends keyof ApiEvents>(
      type: TEvent,
      callback: ((event: ApiEvents[TEvent]) => void) | null,
      options?: EventListenerOptions | boolean,
    ): void;
  }

  export const api: ComfyUIApp;
}
