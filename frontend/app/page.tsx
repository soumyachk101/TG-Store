import { auth } from "@/auth";
import { Dashboard } from "@/components/Dashboard";
import LandingPage from "@/components/LandingPage";

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    return <LandingPage />;
  }

  return <Dashboard />;
}
