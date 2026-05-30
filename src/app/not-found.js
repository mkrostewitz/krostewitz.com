import PublicFooter from "./components/footer/PublicFooter";
import NavBar from "./components/nav/nav";
import NotFoundContent from "./NotFoundContent";
import "./buttons.css";
import styles from "./not-found.module.css";

export const metadata = {
  title: "404",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className={styles.page}>
      <NavBar />

      <main className={styles.main}>
        <NotFoundContent />
      </main>
      <PublicFooter />
    </div>
  );
}
