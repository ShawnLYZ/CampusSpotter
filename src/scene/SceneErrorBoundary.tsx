import { Component, type ReactNode } from 'react';

/** Shows `fallback` instead of crashing when the canvas throws (e.g. WebGL context creation fails at runtime). */
export class SceneErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.warn('3D scene failed; showing the summary instead.', error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
