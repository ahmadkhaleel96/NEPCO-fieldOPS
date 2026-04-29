import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

interface NavItem {
  to: string;
  label: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/assets', label: 'Assets', roles: ['admin', 'engineer', 'team_leader'] },
  { to: '/vehicles', label: 'Vehicles', roles: ['admin', 'engineer', 'team_leader'] },
  { to: '/nfc-tags', label: 'NFC Tags', roles: ['admin'] },
  { to: '/work-permits', label: 'Work Permits', roles: ['admin', 'engineer'] },
  { to: '/inspections', label: 'Inspections', roles: ['admin', 'engineer'] },
  { to: '/users', label: 'Users', roles: ['admin'] },
];

interface SidebarProps {
  userRole: string;
}

export function Sidebar({ userRole }: SidebarProps) {
  return (
    <nav className={styles.sidebar} aria-label="Main navigation">
      <ul className={styles.navList}>
        {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(userRole)).map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
