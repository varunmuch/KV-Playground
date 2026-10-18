import { Link, NavLink } from 'react-router-dom';
import { useLive } from '../live/LiveContext';
import { Badge } from './Badge';

const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'nav__link is-active' : 'nav__link');

export function Header() {
  const live = useLive();
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="logo">
          kv_playground
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end className={linkClass}>
            Learn
          </NavLink>
          <NavLink to="/benchmarks" className={linkClass}>
            Benchmarks
          </NavLink>
        </nav>
        {live && <Badge kind="measured">Model live on {live.gpu}</Badge>}
      </div>
    </header>
  );
}
