import {redirect} from 'next/navigation';
import {getCurrentAdminUser} from '../../lib/adminAuth';
import AdminMuiProvider from '../components/forms/AdminMuiProvider';
import AdminHeader from '../AdminHeader';
import EducationEditor from './EducationEditor';
import styles from '../admin.module.css';
export default async function EducationPage() {
  const user = await getCurrentAdminUser();
  if (!user) redirect('/admin/login');
  return <AdminMuiProvider><div className={styles.shell}><AdminHeader active="education" user={{email: user.email}} /><main className={styles.main}><h1>Education & qualifications</h1><EducationEditor /></main></div></AdminMuiProvider>;
}
