import PublicFooter from "../components/footer/PublicFooter";
import {ImpressumContent} from "../components/legal/LegalPageContent";
import NavBar from "../components/nav/nav";
import {getLegalDetails} from "../lib/legal";
import styles from "../legal.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Impressum - Mathias Krostewitz",
  description: "Legal notice and provider identification for krostewitz.com.",
};

export default async function ImpressumPage() {
  const legal = await getLegalDetails();

  return (
    <div className={styles.page}>
      <NavBar />

      <ImpressumContent legal={legal} />
      <PublicFooter />
    </div>
  );
}
