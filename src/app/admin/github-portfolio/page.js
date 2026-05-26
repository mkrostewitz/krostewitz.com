import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../lib/adminAuth";
import GithubPortfolioSettings from "./GithubPortfolioSettings";

export default async function AdminGithubPortfolioPage() {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return <GithubPortfolioSettings user={user} />;
}
