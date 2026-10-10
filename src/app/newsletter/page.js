import NewsletterManage from "./NewsletterManage";
import NavBar from "../components/nav/nav";
import PublicFooter from "../components/footer/PublicFooter";
import styles from "./newsletter-page.module.css";

export const dynamic = "force-dynamic";
export const metadata = {title: "Newsletter", robots: {index: false, follow: false}, referrer: "no-referrer"};

export default async function NewsletterPage({searchParams}) {
  const params = await searchParams;
  return <div className={styles.page}><NavBar /><main className={styles.main}>
    <NewsletterManage action={typeof params.action === "string" ? params.action : ""}
      token={typeof params.token === "string" ? params.token : ""} language={params.lng === "de" ? "de" : "en"} />
  </main><PublicFooter /></div>;
}
