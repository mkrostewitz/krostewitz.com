import PublicFooter from "../components/footer/PublicFooter";
import {ImpressumContent} from "../components/legal/LegalPageContent";
import NavBar from "../components/nav/nav";
import {getLegalDetails} from "../lib/legal";
import styles from "../legal.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const legal = await getLegalDetails();
  const name = legal.ownerName || legal.siteName;

  return {
    title: `Impressum - ${name}`,
    description: `Legal notice and provider identification for ${legal.siteName}.`,
  };
}

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
