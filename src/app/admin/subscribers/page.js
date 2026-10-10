import Link from "next/link";
import {redirect} from "next/navigation";

import {getCurrentAdminUser} from "../../lib/adminAuth";
import {getDb} from "../../lib/mongo";
import AdminHeader from "../AdminHeader";
import styles from "../admin.module.css";
import listStyles from "./subscribers.module.css";

const PAGE_SIZE = 50;
const STATUSES = {active: "Active", pending: "Pending confirmation", unsubscribed: "Unsubscribed"};
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin",
});

function displayDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export default async function AdminSubscribersPage({searchParams}) {
  const user = await getCurrentAdminUser();
  if (!user) redirect("/admin/login");

  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 254) : "";
  const status = Object.hasOwn(STATUSES, params.status) ? params.status : "";
  const requestedPage = typeof params.page === "string" && /^\d{1,8}$/.test(params.page)
    ? Math.max(1, Number(params.page)) : 1;
  const query = {};
  if (search) query.email = {$regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i"};
  if (status) query.status = status;

  let subscribers = [];
  let total = 0;
  let page = 1;
  let pageCount = 1;
  let failed = false;
  try {
    const db = await getDb();
    const collection = db.collection("newsletter_subscribers");
    total = await collection.countDocuments(query);
    pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(requestedPage, pageCount);
    subscribers = await collection.find(query, {
      projection: {email: 1, status: 1, language: 1, createdAt: 1, confirmedAt: 1, unsubscribedAt: 1},
    }).sort({createdAt: -1, _id: -1}).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray();
  } catch {
    failed = true;
  }

  function pageHref(nextPage) {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (status) next.set("status", status);
    next.set("page", String(nextPage));
    return `/admin/subscribers?${next}`;
  }

  return (
    <div className={styles.shell}>
      <AdminHeader active="subscribers" user={user} />
      <main className={styles.main}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <h1>Subscribers</h1>
            <p className={styles.muted}>Newsletter signups. Only active, confirmed subscribers receive new articles.</p>
          </div>
        </div>

        <form action="/admin/subscribers" className={listStyles.filters}>
          <label className={styles.field}>
            Search email
            <input type="search" name="q" defaultValue={search} placeholder="reader@example.com" maxLength={254} />
          </label>
          <label className={styles.field}>
            Status
            <select name="status" defaultValue={status}>
              <option value="">All statuses</option>
              {Object.entries(STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="submit" className={styles.button}>Apply filters</button>
          <Link href="/admin/subscribers" className={styles.ghostButton}>Reset</Link>
        </form>

        {failed ? (
          <p role="alert" className={styles.error}>Unable to load subscribers. Please refresh the page to try again.</p>
        ) : (
          <>
            <p className={styles.muted}>{total} {total === 1 ? "subscriber" : "subscribers"}{search || status ? " matching your filters" : " total"}</p>
            <div className={listStyles.tableWrapper} role="region" aria-label="Subscriber list" tabIndex={0}>
              <table className={listStyles.table}>
                <caption>Newsletter subscribers · newest signups first · dates in Europe/Berlin</caption>
                <thead><tr>
                  <th scope="col">Email</th><th scope="col">Status</th><th scope="col">Language</th>
                  <th scope="col">Signed up</th><th scope="col">Confirmed</th><th scope="col">Unsubscribed</th>
                </tr></thead>
                <tbody>
                  {subscribers.map((subscriber) => (
                    <tr key={String(subscriber._id)}>
                      <td className={listStyles.email}>{subscriber.email}</td>
                      <td><span className={`${styles.statusBadge} ${subscriber.status === "active" ? styles.statusBadgeSuccess : subscriber.status === "pending" ? styles.statusBadgeWarning : ""}`}>
                        {STATUSES[subscriber.status] || "Unknown"}
                      </span></td>
                      <td>{({de: "German", en: "English"})[subscriber.language] || "—"}</td>
                      <td>{displayDate(subscriber.createdAt)}</td>
                      <td>{displayDate(subscriber.confirmedAt)}</td>
                      <td>{displayDate(subscriber.unsubscribedAt)}</td>
                    </tr>
                  ))}
                  {subscribers.length === 0 && <tr><td colSpan={6} className={listStyles.empty}>
                    {search || status ? "No subscribers match your filters." : "No newsletter subscribers yet."}
                  </td></tr>}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && <nav className={listStyles.pagination} aria-label="Subscriber pages">
              {page > 1 && <Link className={styles.ghostButton} href={pageHref(page - 1)}>Previous</Link>}
              <span>Page {page} of {pageCount}</span>
              {page < pageCount && <Link className={styles.ghostButton} href={pageHref(page + 1)}>Next</Link>}
            </nav>}
          </>
        )}
        <p className={styles.muted}>Unconfirmed signups expire after 24 hours. Unsubscribed records are deleted after 30 days.</p>
      </main>
    </div>
  );
}
