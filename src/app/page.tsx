'use client'

import AddressInput from "@/components/AddressInput";
import Hero from "@/components/Hero";
import { useState } from "react";

export default function Home() {
  const [nanoAddress, setNanoAddress] = useState<string | null>(null);
  return (
    <>
      <section className="flex flex-col flex-1 justify-center items-center py-8">
        <Hero />
        <div className="w-96 sm:w-[448px] max-w-full px-4 py-4 sm:py-8">
          <AddressInput
            onValidAddress={setNanoAddress}
            onInvalidAddress={() => setNanoAddress(null)}
            onSubmit={console.log}
          />
        </div>
      </section>
    </>
  );
}
