import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

export function NotFoundPage() {
  return (
    <div className="container">
      <PageHeader eyebrow="404" title="Nothing cached at this address." />
      <p style={{ marginTop: 24 }}>
        <Link to="/" className="btn btn--primary">
          Back to overview
        </Link>
      </p>
    </div>
  );
}
