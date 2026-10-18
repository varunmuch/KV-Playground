import { site } from '../config/site';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <span className="mono">kv_playground · made by {site.author}</span>
        {site.repoUrl && <a href={site.repoUrl}>Source on GitHub</a>}
      </div>
    </footer>
  );
}
