import { BrandLogo } from "@/components/BrandLogo";

export function LandingHeroIntro() {
  return (
    <div className="landing-hero-intro">
      <BrandLogo href="/" size="xl" className="landing-hero-logo" />
      <p className="landing-hero-tagline">Your trusted document workflow</p>
    </div>
  );
}
