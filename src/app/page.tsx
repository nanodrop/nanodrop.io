import Hero from "@/components/Hero";

export default function Home() {
  return (
    <>
      <section className="flex flex-col flex-1 justify-center items-center py-8">
        <Hero />
        <div className="w-96 sm:w-[448px] max-w-full px-4 py-4 sm:py-8">
        </div>
      </section>
    </>
  );
}
