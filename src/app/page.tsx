import HeroVisual from "@/components/HeroVisual";
import PhoneInput from "@/components/PhoneInput";

export default function Home() {
  return (
    <section className="flex-1 flex flex-col items-center text-center px-4 pt-14 sm:pt-20">
      <h1 className="text-4xl sm:text-6xl font-medium tracking-tight leading-[1.12] text-frost">
        When a number reaches out,
        <br />
        know who&apos;s calling.
      </h1>
      <div className="mt-9 w-full max-w-lg">
        <PhoneInput large />
      </div>
      <div className="flex-1 w-full">
        <HeroVisual />
      </div>
    </section>
  );
}
