"use client";

import { useState } from "react";
import { Header, type View } from "@/components/Header";
import { HydrationGate } from "@/components/HydrationGate";
import { MainTab } from "@/components/MainTab";
import { ProductionTab } from "@/components/ProductionTab";
import { SettingsTab } from "@/components/SettingsTab";

export default function Home() {
  const [view, setView] = useState<View>("main");

  return (
    <main className="min-h-full flex flex-col">
      <Header view={view} setView={setView} />

      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {view === "production" && <ProductionTab />}
        {view === "main" && (
          <HydrationGate>
            <MainTab />
          </HydrationGate>
        )}
        {view === "settings" && (
          <HydrationGate>
            <SettingsTab />
          </HydrationGate>
        )}
      </div>
    </main>
  );
}
