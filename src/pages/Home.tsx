import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Search, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { MainNav } from "@/components/MainNav";
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, RecipeCollection } from "@/services/api";
import { Recipe } from "@/types/recipe";
import { resolveImageUrl } from "@/utils/api";
import { getRecentRecipeIds } from "@/utils/recentRecipes";
import { getRecentSources } from "@/utils/recentSources";
import { getRecipeSource } from "@/utils/siteUtils";
import { THEME_LOGOS } from "@/utils/themeLogos";
import recetasTodas from "../../imagenes/banners/1-todas las recetas.jpg";
import recetasFavoritas from "../../imagenes/banners/2-recetas favoritas.jpg";
import recetasCocinadas from "../../imagenes/banners/3-recetas preparadas.webp";
import recetasThermomix from "../../imagenes/banners/4-recetas thermomix.jpg";
import recetasAirFryer from "../../imagenes/banners/5-recetas air fryer.webp";
import recetasSinGluten from "../../imagenes/banners/6-recetas sin gluten.jpg";
import recetasKeto from "../../imagenes/banners/7-recetas keto.webp";
import recetasLowCarb from "../../imagenes/banners/8-recetas low carb.webp";
import recetasProteicas from "../../imagenes/banners/9-recetas proteicas.jpg";
import recetasVegetarianas from "../../imagenes/banners/10-recetas vegetarianas.jpg";
import bannerHome from "../../imagenes/banners/banner aguamarina 7.jpg";
import bannerRosa from "../../imagenes/banners/banner rosa 1.jpg";
import bannerAmarillo from "../../imagenes/banners/banner amarillo 1.jpg";
import cookingIsLove from "../../imagenes/banners/banner amarillo - cooking is love.png";
import logoHome from "../../imagenes/logos/logo home tastebox.png";

const pinkBannerTexts = [
  "Recetas para Thermomix",
  "Recetas para Air Fryer",
  "Recetas Sin Gluten",
  "Recetas Keto",
  "Recetas Low Carb",
  "Recetas Proteicas",
  "Recetas Vegetarianas",
];

const recipeLinks = [
  { label: "Todas las recetas", to: "/buscar", image: recetasTodas },
  { label: "Favoritas", to: "/buscar?filtro=favoritas", image: recetasFavoritas },
  { label: "Cocinadas", to: "/buscar?filtro=cocinadas", image: recetasCocinadas },
  { label: "Thermomix", to: "/buscar?filtro=thermomix", image: recetasThermomix },
  { label: "Air Fryer", to: "/buscar?filtro=air-fryer", image: recetasAirFryer },
  { label: "Sin gluten", to: "/buscar?filtro=sin-gluten", image: recetasSinGluten },
  { label: "Keto", to: "/buscar?filtro=keto", image: recetasKeto },
  { label: "Low Carb", to: "/buscar?filtro=low-carb", image: recetasLowCarb },
  { label: "Proteicas", to: "/buscar?filtro=proteicas", image: recetasProteicas },
  { label: "Vegetarianas", to: "/buscar?filtro=vegetarianas", image: recetasVegetarianas },
];

const Home = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [homeSearch, setHomeSearch] = useState("");
  const [homeSearchTerms, setHomeSearchTerms] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [collections, setCollections] = useState<RecipeCollection[]>([]);
  const [sourceCovers, setSourceCovers] = useState<Record<string, string | null>>({});
  const [dishTypeCovers, setDishTypeCovers] = useState<Record<string, string | null>>({});
  const [recentSources, setRecentSources] = useState<string[]>([]);
  const [recentRecipeIds, setRecentRecipeIds] = useState<string[]>([]);
  const [activeBanner, setActiveBanner] = useState(0);

  useEffect(() => {
    setRecentSources(getRecentSources());
    setRecentRecipeIds(getRecentRecipeIds());

    if (!user) {
      setRecipes([]);
      setCollections([]);
      setSourceCovers({});
      setDishTypeCovers({});
      return;
    }

    Promise.all([
      api.recipes.getAll().catch(() => [] as Recipe[]),
      api.collections.getAll().catch(() => [] as RecipeCollection[]),
      api.sources.getAll().catch(() => [] as Array<{ name: string; coverImage: string | null }>),
      api.dishTypes.getAll().catch(() => [] as Array<{ name: string; coverImage: string | null }>),
    ]).then(([loadedRecipes, loadedCollections, loadedSources, loadedDishTypes]) => {
      setRecipes(loadedRecipes);
      setCollections(loadedCollections);
      setSourceCovers(
        Object.fromEntries(loadedSources.map((source) => [source.name, source.coverImage]))
      );
      setDishTypeCovers(
        Object.fromEntries(loadedDishTypes.map((dishType) => [dishType.name, dishType.coverImage]))
      );
    });
  }, [user]);

  useEffect(() => {
    const bannerTimer = window.setInterval(() => {
      setActiveBanner((current) => (current + 1) % 3);
    }, 10000);

    return () => window.clearInterval(bannerTimer);
  }, []);

  const recentSourceCards = useMemo(() => {
    return recentSources.slice(0, 8).map((name) => {
      const coverFromSource = sourceCovers[name];
      const recipesFromSource = recipes.filter((recipe) =>
        getRecipeSource(recipe).toLocaleLowerCase("es") === name.toLocaleLowerCase("es")
      );
      const recipeCover = recipesFromSource.find((recipe) => recipe.images?.[0]?.url)?.images?.[0]?.url;

      return {
        name,
        count: recipesFromSource.length,
        cover: coverFromSource || recipeCover || null,
      };
    });
  }, [recentSources, recipes, sourceCovers]);

  const recentVisitedRecipes = useMemo(() => {
    return recentRecipeIds
      .map((recipeId) => recipes.find((recipe) => recipe.id === recipeId))
      .filter((recipe): recipe is Recipe => Boolean(recipe))
      .slice(0, 12);
  }, [recentRecipeIds, recipes]);

  const collectionCards = useMemo(() => {
    return collections
      .map((collection) => {
        const recipeCover = collection.recipeIds
          .map((recipeId) => recipes.find((recipe) => recipe.id === recipeId))
          .find((recipe) => recipe?.images?.[0]?.url)?.images?.[0]?.url;

        return {
          ...collection,
          cover: collection.coverImage || recipeCover || null,
        };
      })
      .sort((a, b) => b.recipeCount - a.recipeCount || a.name.localeCompare(b.name, "es"))
      .slice(0, 10);
  }, [collections, recipes]);

  const dishTypeCards = useMemo(() => {
    const byName = new Map<string, { name: string; count: number; cover: string | null }>();

    const addDishType = (name: string, cover: string | null = null) => {
      const cleanName = name.trim();
      if (!cleanName) return;
      const key = cleanName.toLocaleLowerCase();
      const existing = byName.get(key);

      if (existing) {
        existing.count += 1;
        if (cover && !existing.cover) existing.cover = cover;
        return;
      }

      byName.set(key, { name: cleanName, count: 1, cover });
    };

    recipes.forEach((recipe) => {
      const recipeCover = recipe.images?.[0]?.url || null;
      (recipe.dishType || "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .forEach((name) => addDishType(name, recipeCover));
    });

    Object.entries(dishTypeCovers).forEach(([name, cover]) => {
      const key = name.toLocaleLowerCase();
      const existing = byName.get(key);
      if (existing) {
        if (cover && !existing.cover) existing.cover = cover;
      } else {
        byName.set(key, { name, count: 0, cover });
      }
    });

    return Array.from(byName.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"))
      .slice(0, 10);
  }, [dishTypeCovers, recipes]);

  const handleHomeSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const terms = [...homeSearchTerms, homeSearch.trim()]
      .map((term) => term.trim())
      .filter(Boolean)
      .filter((term, index, allTerms) =>
        allTerms.findIndex((item) => item.toLocaleLowerCase() === term.toLocaleLowerCase()) === index
      );

    if (terms.length === 0) return;

    const params = new URLSearchParams();
    terms.forEach((term) => params.append("buscar", term));
    navigate(`/buscar?${params.toString()}`);
  };

  const handleHomeSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;

    const term = homeSearch.trim();
    if (!term) return;

    event.preventDefault();
    setHomeSearchTerms((current) =>
      current.some((item) => item.toLocaleLowerCase() === term.toLocaleLowerCase())
        ? current
        : [...current, term]
    );
    setHomeSearch("");
  };

  return (
    <main className="min-h-screen bg-[#fff8f8]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-8 pt-28 sm:px-6 sm:pt-32">
        <header className="fixed left-0 top-0 z-50 w-full border-b border-pink-100 bg-[#fff8f8]/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link to="/" className="inline-flex shrink-0 items-center justify-center sm:justify-start">
            <img
              src={THEME_LOGOS[theme]}
              alt="TasteBox"
              className="h-14 w-auto max-w-[220px] object-contain"
            />
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
            <MainNav />
            <UserMenu />
          </div>
          </div>
        </header>

        <div className="relative overflow-hidden rounded-lg border border-pink-100 shadow-sm">
          <img
            src={bannerHome}
            alt="TasteBox"
            className="w-full object-cover opacity-0"
          />
          <img
            src={bannerHome}
            alt="TasteBox"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              activeBanner === 0 ? "opacity-100" : "opacity-0"
            }`}
          />
          <img
            src={bannerRosa}
            alt="TasteBox"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              activeBanner === 1 ? "opacity-100" : "opacity-0"
            }`}
          />
          <img
            src={bannerAmarillo}
            alt="TasteBox"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              activeBanner === 2 ? "opacity-100" : "opacity-0"
            }`}
          />
          <div className="pointer-events-none absolute inset-0">
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center gap-1 transition-opacity duration-700 sm:gap-2 ${
                activeBanner === 0 ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="home-banner-title" aria-label="Mis Recetas">
                {"Mis Recetas".split("").map((letter, index) => (
                  <span
                    key={`${letter}-${index}`}
                    className="home-banner-title-letter"
                    aria-hidden="true"
                  >
                    {letter === " " ? "\u00A0" : letter}
                  </span>
                ))}
              </div>
              <img
                key={activeBanner === 0 ? "home-logo-visible" : "home-logo-hidden"}
                src={logoHome}
                alt=""
                aria-hidden="true"
                className="home-banner-logo w-[clamp(9rem,28vw,22rem)] object-contain"
              />
            </div>

            <div
              className={`home-pink-banner-copy absolute inset-0 flex flex-col items-center justify-center px-5 text-center transition-opacity duration-700 ${
                activeBanner === 1 ? "opacity-100" : "opacity-0"
              } ${activeBanner === 1 ? "home-pink-banner-copy--active" : ""}`}
            >
              {pinkBannerTexts.map((text, index) => (
                <div
                  key={text}
                  className="home-pink-banner-line"
                  style={{ animationDelay: `${index * 850}ms` }}
                >
                  {text}
                </div>
              ))}
            </div>

            <div
              className={`absolute inset-0 flex items-start justify-center px-6 pt-5 transition-opacity duration-700 sm:pt-8 ${
                activeBanner === 2 ? "opacity-100" : "opacity-0"
              }`}
            >
              <img
                key={activeBanner === 2 ? "cooking-love-visible" : "cooking-love-hidden"}
                src={cookingIsLove}
                alt=""
                aria-hidden="true"
                className="home-cooking-love w-[clamp(3.3rem,11vw,8.25rem)] object-contain"
              />
            </div>
          </div>
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {[0, 1, 2].map((bannerIndex) => {
              const active = activeBanner === bannerIndex;

              return (
                <button
                  key={`banner-${bannerIndex}`}
                  type="button"
                  onClick={() => setActiveBanner(bannerIndex)}
                  className={`home-banner-dot ${active ? "home-banner-dot--active" : ""}`}
                  aria-label={`Ver banner ${bannerIndex + 1}`}
                  aria-current={active ? "true" : undefined}
                />
              );
            })}
          </div>
        </div>

        <form
          onSubmit={handleHomeSearch}
          className="mt-8 rounded-lg border border-pink-100 bg-white/85 p-5 shadow-sm"
        >
          <label htmlFor="home-search" className="home-section-title mb-3 block text-foreground">
            Buscar en TasteBox
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="home-search"
                value={homeSearch}
                onChange={(event) => setHomeSearch(event.target.value)}
                onKeyDown={handleHomeSearchKeyDown}
                placeholder="Buscar por receta o ingredientes (ENTER para agregar)"
                title="Escribi una palabra y pulsa Enter para agregarla. Podes sumar varias."
                className="h-12 pl-12 pr-10 text-base"
              />
              {homeSearch && (
                <button
                  type="button"
                  onClick={() => setHomeSearch("")}
                  className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Borrar busqueda"
                  title="Borrar busqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button type="submit" className="h-12 px-8">
              Buscar
            </Button>
          </div>
          {homeSearchTerms.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {homeSearchTerms.map((term, index) => (
                <span
                  key={`${term}-${index}`}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1 text-sm font-medium text-primary"
                >
                  {term}
                  <button
                    type="button"
                    onClick={() => setHomeSearchTerms((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-primary/70 transition-colors hover:bg-primary/20 hover:text-primary"
                    aria-label={`Quitar ${term}`}
                    title="Quitar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => setHomeSearchTerms([])}
                className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Limpiar
              </button>
            </div>
          )}
        </form>

        <section className="mt-10">
          <h2 className="home-section-title mb-5 text-foreground">Que queres cocinar?</h2>
          {collectionCards.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {collectionCards.map((collection) => (
                <Link
                  key={collection.id}
                  to={`/buscar?collection=${encodeURIComponent(collection.id)}`}
                  className="group relative flex h-32 overflow-hidden rounded-lg border border-pink-100 bg-white p-4 text-left text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
                >
                  {collection.cover ? (
                    <img
                      src={resolveImageUrl(collection.cover)}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="absolute inset-0 bg-[#f3f0e8]" aria-hidden="true" />
                  )}
                  <span className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/15" aria-hidden="true" />
                  <span className="relative z-10 mt-auto rounded-md bg-white/90 px-3 py-1.5 text-foreground shadow-sm">
                    {collection.name}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Todavia no hay colecciones para mostrar.</p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="home-section-title mb-5 text-foreground">Sitios preferidos</h2>
          {recentSourceCards.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recentSourceCards.map((source) => (
                <Link
                  key={source.name}
                  to={`/buscar?fuente=${encodeURIComponent(source.name)}`}
                  className="group relative flex h-28 overflow-hidden rounded-lg bg-[#f3f0e8] p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative z-10 flex max-w-[62%] flex-col justify-center">
                    <span className="text-base font-semibold leading-tight text-foreground">{source.name}</span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      {source.count} receta{source.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {source.cover && (
                    <img
                      src={resolveImageUrl(source.cover)}
                      alt=""
                      aria-hidden="true"
                      className="absolute bottom-0 right-0 h-full w-1/2 object-cover transition-transform group-hover:scale-105"
                    />
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Todavia no exploraste fuentes.</p>
          )}
          <h3 className="home-section-title mb-5 mt-10 text-foreground">Recetas visitadas recientemente</h3>
          {recentVisitedRecipes.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              {recentVisitedRecipes.map((recipe) => {
                const cover = recipe.images?.[0]?.url;

                return (
                  <Link
                    key={recipe.id}
                    to={`/buscar?buscar=${encodeURIComponent(recipe.title)}`}
                    className="group overflow-hidden rounded-lg bg-white text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {cover ? (
                      <img
                        src={resolveImageUrl(cover)}
                        alt={recipe.title}
                        className="h-28 w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-28 w-full bg-[#f3f0e8]" aria-hidden="true" />
                    )}
                    <div className="p-3">
                      <span className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
                        {recipe.title}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{"Todav\u00eda no visitaste recetas."}</p>
          )}

          <h3 className="home-section-title mb-5 mt-10 text-foreground">Recetas</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {recipeLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group relative flex h-32 overflow-hidden rounded-lg border border-pink-100 bg-white p-4 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
              >
                <img
                  src={item.image}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/15" aria-hidden="true" />
                <span className="relative z-10 mt-auto rounded-md bg-white/90 px-3 py-1.5 text-foreground shadow-sm">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>

          <h3 className="home-section-title mb-5 mt-10 text-foreground">Tipo de comida</h3>
          {dishTypeCards.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {dishTypeCards.map((dishType) => (
                <Link
                  key={dishType.name}
                  to={`/buscar?tipo=${encodeURIComponent(dishType.name)}`}
                  className="group relative flex h-24 overflow-hidden rounded-lg border border-pink-100 bg-[#f8f4f0] text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
                >
                  {dishType.cover ? (
                    <img
                      src={resolveImageUrl(dishType.cover)}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover opacity-70 saturate-[0.9] transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(226,102,102,0.24),transparent_34%),linear-gradient(135deg,#fff7f4,#edf7f4)]" aria-hidden="true" />
                  )}
                  <span className="absolute inset-0 bg-white/15 transition-colors group-hover:bg-white/5" aria-hidden="true" />
                  <span className="relative z-10 mt-auto flex w-full items-end justify-between gap-2 bg-white/88 px-3 py-2 backdrop-blur-sm">
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">{dishType.name}</span>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {dishType.count}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Todavia no hay tipos de comida para mostrar.</p>
          )}
        </section>
      </section>

      <footer className="mt-auto bg-primary py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="flex items-center justify-center gap-1 text-center text-sm text-primary-foreground">
            {"\u00a9 Copyright 2025 - TasteBox - Hecho con"}
            <Heart className="h-3.5 w-3.5 fill-white text-white" />
          </p>
        </div>
      </footer>
    </main>
  );
};

export default Home;
