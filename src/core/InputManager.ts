// ========================
// Input Manager — Keyboard + Mouse tracking
// ========================

export interface InputState {
  keys: Set<string>;
  keysJustPressed: Set<string>;
  keysJustReleased: Set<string>;
  mouse: {
    x: number;
    y: number;
    worldX: number;
    worldY: number;
    leftDown: boolean;
    rightDown: boolean;
    leftJustPressed: boolean;
    rightJustPressed: boolean;
  };
}

export class InputManager {
  private static instance: InputManager;

  private keysDown = new Set<string>();
  private keysPressed = new Set<string>();
  private keysReleased = new Set<string>();

  private mouseX = 0;
  private mouseY = 0;
  private mouseWorldX = 0;
  private mouseWorldY = 0;
  private mouseLeftDown = false;
  private mouseRightDown = false;
  private mouseLeftJustPressed = false;
  private mouseRightJustPressed = false;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundContextMenu: (e: Event) => void;

  static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  private constructor() {
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundContextMenu = (e: Event) => e.preventDefault();
  }

  /** Attach event listeners to the window */
  init(): void {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('mousemove', this.boundMouseMove);
    window.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('mouseup', this.boundMouseUp);
    window.addEventListener('contextmenu', this.boundContextMenu);
  }

  /** Detach event listeners */
  destroy(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('mousemove', this.boundMouseMove);
    window.removeEventListener('mousedown', this.boundMouseDown);
    window.removeEventListener('mouseup', this.boundMouseUp);
    window.removeEventListener('contextmenu', this.boundContextMenu);
  }

  /** Call at the end of each frame to clear "just pressed/released" state */
  endFrame(): void {
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.mouseLeftJustPressed = false;
    this.mouseRightJustPressed = false;
  }

  /** Check if a key is currently held down */
  isKeyDown(key: string): boolean {
    return this.keysDown.has(key.toLowerCase());
  }

  /** Check if a key was just pressed this frame */
  isKeyJustPressed(key: string): boolean {
    return this.keysPressed.has(key.toLowerCase());
  }

  /** Check if a key was just released this frame */
  isKeyJustReleased(key: string): boolean {
    return this.keysReleased.has(key.toLowerCase());
  }

  /** Get current movement vector from WASD/Arrow keys */
  getMovementVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;

    if (this.isKeyDown('w') || this.isKeyDown('arrowup')) y -= 1;
    if (this.isKeyDown('s') || this.isKeyDown('arrowdown')) y += 1;
    if (this.isKeyDown('a') || this.isKeyDown('arrowleft')) x -= 1;
    if (this.isKeyDown('d') || this.isKeyDown('arrowright')) x += 1;

    // Normalize diagonal movement
    if (x !== 0 && y !== 0) {
      const len = Math.sqrt(x * x + y * y);
      x /= len;
      y /= len;
    }

    return { x, y };
  }

  /** Get full input state snapshot */
  getState(): InputState {
    return {
      keys: new Set(this.keysDown),
      keysJustPressed: new Set(this.keysPressed),
      keysJustReleased: new Set(this.keysReleased),
      mouse: {
        x: this.mouseX,
        y: this.mouseY,
        worldX: this.mouseWorldX,
        worldY: this.mouseWorldY,
        leftDown: this.mouseLeftDown,
        rightDown: this.mouseRightDown,
        leftJustPressed: this.mouseLeftJustPressed,
        rightJustPressed: this.mouseRightJustPressed,
      },
    };
  }

  /** Update mouse world coordinates (called by camera system) */
  setWorldMouse(x: number, y: number): void {
    this.mouseWorldX = x;
    this.mouseWorldY = y;
  }

  // -- Event handlers --

  private onKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    if (!this.keysDown.has(key)) {
      this.keysPressed.add(key);
    }
    this.keysDown.add(key);

    // Prevent browser scroll on arrow keys & space
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
      e.preventDefault();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    this.keysDown.delete(key);
    this.keysReleased.add(key);
  }

  private onMouseMove(e: MouseEvent): void {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      this.mouseLeftDown = true;
      this.mouseLeftJustPressed = true;
    }
    if (e.button === 2) {
      this.mouseRightDown = true;
      this.mouseRightJustPressed = true;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) this.mouseLeftDown = false;
    if (e.button === 2) this.mouseRightDown = false;
  }
}
