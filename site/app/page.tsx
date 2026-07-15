import { Navigation } from "./components/landing/ui/navigation";
import { ShaderBackground } from "./components/landing/ui/shader-background";
import { HeroSection } from "./components/landing/sections/hero-section";
import { HowItWorksSection } from "./components/landing/sections/how-it-works-section";
import { OverviewSections } from "./components/landing/sections/overview-sections";
import { ClosingSection, SiteFooter } from "./components/landing/sections/site-footer";
import { SetupAndApiSections } from "./components/landing/sections/setup-and-api-sections";

export default function Home() {
  return (
    <div className="relative">
      <ShaderBackground />
      <Navigation />

      <main id="main-content">
        <HeroSection />
        <OverviewSections />
        <HowItWorksSection />
        <SetupAndApiSections />
        <ClosingSection />
      </main>

      <SiteFooter />
    </div>
  );
}
