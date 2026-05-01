// Lightweight screen contract. Every overlay UI surface in `src/ui/screens/`
// exports a `render(props)` that returns a string of HTML and an optional
// `bind(root, props)` that wires post-render side effects (canvas paints,
// focus management, listeners scoped to the new DOM).
//
// Click handlers stay in the central Game listener for now; this contract
// specifically extracts the *template + per-screen DOM bindings* so each
// screen can be tested in isolation. A later phase can collapse the
// central click router into per-screen handlers without touching the
// templates themselves.

export interface Screen<Props> {
  render(props: Props): string;
  /** Optional: per-screen DOM wiring run after the rendered HTML lands.
   *  Returns a cleanup callback if there's anything to dispose. */
  bind?(root: HTMLElement, props: Props): (() => void) | void;
}
