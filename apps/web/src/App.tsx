import { SignInGate } from "@/components/sign-in-gate";
import { SiteLayout } from "@/components/site-layout";
import { AreaPage } from "@/pages/area";
import { ComparePage } from "@/pages/compare";
import { CondosPage } from "@/pages/condos";
import { GuidePage } from "@/pages/guide";
import { HomePage } from "@/pages/home";
import { NotFoundPage, PrivacyPage, TermsPage, UnauthorizedPage } from "@/pages/legal";
import { MapPage } from "@/pages/map";
import { RankingsPage } from "@/pages/rankings";
import { VersionPage } from "@/pages/version";
import { isPublicPage, type Route } from "@/routes";

export function App({ route }: { route: Route }) {
  return (
    <SiteLayout page={route.page} wide={route.page === "map" || route.page === "condos"}>
      {isPublicPage(route.page) ? (
        <Page route={route} />
      ) : (
        <SignInGate>
          <Page route={route} />
        </SignInGate>
      )}
    </SiteLayout>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case "home":
      return <HomePage />;
    case "map":
      return <MapPage />;
    case "condos":
      return <CondosPage />;
    case "rankings":
      return <RankingsPage />;
    case "compare":
      return <ComparePage />;
    case "guide":
      return <GuidePage />;
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
