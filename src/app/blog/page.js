import NavBar from "../components/nav/nav";
import PublicFooter from "../components/footer/PublicFooter";
import BlogSection from "../components/blog/BlogSection";
import styles from "../page.module.css";

export const metadata = {
  title: "Blog",
  description: "Explore all posts and search by topic or tag.",
};

export default function BlogPage() {
  return <div className={styles.page}>
    <NavBar />
    <main className={styles.main}><BlogSection archive /></main>
    <PublicFooter />
  </div>;
}
