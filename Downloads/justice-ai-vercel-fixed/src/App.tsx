import React, { useState } from "react";
import LandingScreen from "./screens/LandingScreen";
import AnalyzingScreen from "./screens/AnalyzingScreen";
import ChatHome from "./screens/ChatHome";

type Screen = "landing" | "analyzing" | "chat";

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");

  if (screen === "landing") {
    return <LandingScreen onContinue={() => setScreen("analyzing")} />;
  }

  if (screen === "analyzing") {
    return <AnalyzingScreen onComplete={() => setScreen("chat")} />;
  }

  return <ChatHome />;
}
