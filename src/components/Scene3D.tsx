"use client";
import dynamic from "next/dynamic";
import { Component, type ReactNode, useEffect, useState } from "react";
import type { CitySceneProps } from "./CityScene";

const CityScene = dynamic(() => import("./CityScene"), { ssr: false });

/** If WebGL ever throws, fall back to the static gradient instead of blanking the page. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    console.error("[3d] scene failed, using static fallback:", e.message);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** WebGL scene with a graceful static fallback (no WebGL / low-power / save-data). */
export default function Scene3D(props: CitySceneProps) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2") || c.getContext("webgl");
      const saveData = (navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData;
      setOk(Boolean(gl) && !saveData);
    } catch {
      setOk(false);
    }
  }, []);
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(60% 50% at 50% 60%, ${props.accent}30, transparent 70%), #0a090b`,
        }}
      />
      {ok ? (
        <SceneBoundary>
          <CityScene {...props} />
        </SceneBoundary>
      ) : null}
    </div>
  );
}
