"use client";

import { MeshGradient } from "@paper-design/shaders-react";
import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const SHADER_COLORS = ["#040807", "#0a2a20", "#0e4534", "#10b981"];

function subscribeToReducedMotion(onStoreChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getServerReducedMotionSnapshot() {
  return false;
}

export function ShaderBackground() {
  const reduced = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-180 max-h-220 overflow-hidden"
      style={{
        maskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
      }}
    >
      <MeshGradient
        colors={SHADER_COLORS}
        distortion={0.8}
        swirl={0.6}
        speed={reduced ? 0 : 0.08}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-paper" />
    </div>
  );
}
