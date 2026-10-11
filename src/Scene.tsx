import { useCallback } from "react";
import { MengToSketchbookLandingPage } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";
import { applyMobileSketchbookPan } from "./sketchbook/mobileSketchbookPan";

export function Scene() {
  // Mobile-only framing (left-page focus + horizontal pan) injected into the
  // live frame. Desktop behavior is untouched; see mobileSketchbookPan.ts.
  const applyScene = useCallback(applyMobileSketchbookPan, []);

  return (
    <div className="shader-frame">
      <MengToSketchbookLandingPage
        headingFont="instrument-serif"
        bodyFont="newsreader"
        headingWeight="400"
        bodyWeight="400"
        primaryColor="#2b2721"
        headingSize={30}
        bodySize={20}
        headingLetterSpacing={0.010}
        applyScene={applyScene}
      />
    </div>
  );
}
