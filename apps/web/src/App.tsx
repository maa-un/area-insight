import { SiteLayout } from "@/components/site-layout";
import { AreaPage } from "@/pages/area";
import { ComparePage } from "@/pages/compare";
import { HomePage } from "@/pages/home";
import { NotFoundPage, PrivacyPage, TermsPage, UnauthorizedPage } from "@/pages/legal";
import { MapPage } from "@/pages/map";
import { RankingsPage } from "@/pages/rankings";
import { VersionPage } from "@/pages/version";
import type { Route } from "@/routes";

export function App({ route }: { route: Route }) {
  return (
    <SiteLayout page={route.page} wide={route.page === "map"}>
      <Page route={route} />
    </SiteLayout>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case "home":
      return <HomePage />;
    case "map":
      return <MapPage />;
    case "rankings":
      return <RankingsPage />;
    case "compare":
      return <ComparePage />;
    case "area":
      return <AreaPage detail={route.detail} />;
    case "privacy":
      return <PrivacyPage />;
    case "terms":
      return <TermsPage />;
    case "version":
      return <VersionPage />;
    case "unauthorized":
      return <UnauthorizedPage />;
    case "not-found":
      return <NotFoundPage />;
  }
}
