import PublicFooter from "../components/footer/PublicFooter";
import {PrivacyContent} from "../components/legal/LegalPageContent";
import NavBar from "../components/nav/nav";
import {getLegalDetails} from "../lib/legal";
import styles from "../legal.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Privacy Policy - Mathias Krostewitz",
  description:
    "Privacy policy for krostewitz.com, including contact forms, analytics, maps, media, and LinkedIn publishing integration.",
};

export default async function PrivacyPage() {
  const legal = await getLegalDetails();

  return (
    <div className={styles.page}>
      <NavBar />

      <PrivacyContent legal={legal} />
      <PublicFooter />
    </div>
  );
}
