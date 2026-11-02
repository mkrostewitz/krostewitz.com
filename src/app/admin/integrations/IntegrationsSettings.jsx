"use client";

import AdminMuiProvider from "../components/forms/AdminMuiProvider";
import AdminHeader from "../AdminHeader";
import ApolloSettings from "./ApolloSettings";
import styles from "../admin.module.css";

export default function IntegrationsSettings({user}) {
  return <div className={styles.shell}>
    <AdminHeader active="integrations" user={user} />
    <main className={styles.main}>
      <div className={styles.toolbar}>
        <div className={styles.titleBlock}>
          <h1>Integrations</h1>
          <p className={styles.muted}>Connect optional services and manage their credentials. Enable only the services you want to use.</p>
        </div>
      </div>
      <div className={styles.settingsGrid}>
        <AdminMuiProvider><ApolloSettings /></AdminMuiProvider>
      </div>
    </main>
  </div>;
}
