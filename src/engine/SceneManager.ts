import { type Application, Container } from 'pixi.js';

/**
 * Interface that scenes can implement for lifecycle hooks.
 */
export interface Scene extends Container {
  /** Called when the scene is added to the stage. */
  onEnter?(data?: unknown): void;
  /** Called when the scene is removed from the stage. */
  onExit?(): void;
  /** Called every frame via the application ticker. */
  onUpdate?(dt: number): void;
  /** Called once on resize. */
  onResize?(width: number, height: number): void;
}

/**
 * Manages a set of named scenes on a Pixi Application stage.
 * Only one scene is active at a time.
 */
export class SceneManager {
  private scenes = new Map<string, Scene>();
  private currentName: string | null = null;
  private currentScene: Scene | null = null;
  private app: Application;

  constructor(app: Application) {
    this.app = app;

    // Wire the ticker to forward updates to the active scene
    this.app.ticker.add((ticker) => {
      this.currentScene?.onUpdate?.(ticker.deltaTime);
    });

    // Forward resize events
    window.addEventListener('resize', () => {
      const { width, height } = this.app.screen;
      this.currentScene?.onResize?.(width, height);
    });
  }

  /** Register a scene by name. */
  register(name: string, scene: Scene): void {
    this.scenes.set(name, scene);
  }

  /** Switch to a registered scene, passing optional data. */
  switchTo(name: string, data?: unknown): void {
    const next = this.scenes.get(name);
    if (!next) {
      console.warn(`SceneManager: scene "${name}" not registered`);
      return;
    }

    // Remove current scene
    if (this.currentScene) {
      this.currentScene.onExit?.();
      this.app.stage.removeChild(this.currentScene);
    }

    // Add next scene
    this.currentName = name;
    this.currentScene = next;
    this.app.stage.addChild(next);

    // Notify it of the current screen size then call onEnter
    const { width, height } = this.app.screen;
    next.onResize?.(width, height);
    next.onEnter?.(data);
  }

  /** Get the name of the currently active scene. */
  get active(): string | null {
    return this.currentName;
  }
}
