import { Link } from "react-router-dom";
import { Theme, useTheme } from "@/contexts/ThemeContext";
import { MainNav } from "@/components/MainNav";
import { UserMenu } from "@/components/UserMenu";
import bannerHome from "../../imagenes/banner tastebox home.jpg";

const themeLogos: Record<Theme, string> = {
  carrot: "/logos/logo_carrot.png",
  violetas: "/logos/logo_violetas.png",
  tierra: "/logos/logo_tierra.png",
  frutilla: "/logos/logo_frutilla.png",
  aguamarina: "/logos/logo_aguamarina.png",
  pasteles: "/logos/logo_pasteles.png",
};

const Home = () => {
  const { theme } = useTheme();

  return (
    <main className="min-h-screen bg-[#fff8f8]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-8 sm:px-6">
        <header className="mb-5 flex flex-col gap-4 px-1 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="inline-flex shrink-0 items-center justify-center sm:justify-start">
            <img
              src={themeLogos[theme]}
              alt="TasteBox"
              className="h-14 w-auto max-w-[220px] object-contain"
            />
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
            <MainNav />
            <UserMenu />
          </div>
        </header>

        <img
          src={bannerHome}
          alt="TasteBox"
          className="w-full rounded-lg border border-pink-100 object-cover shadow-sm"
        />
      </section>
    </main>
  );
};

export default Home;
