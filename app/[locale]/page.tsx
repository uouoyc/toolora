import { Header } from "@/components/header";
import { HomeView } from "@/components/home-view";

export default async function LocaleHomePage() {
  return (
    <main className="bg-background text-foreground selection:bg-primary selection:text-primary-foreground flex min-h-screen w-full flex-col font-sans">
      <Header />
      <HomeView />
    </main>
  );
}
