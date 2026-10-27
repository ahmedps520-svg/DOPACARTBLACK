import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Empty } from '../components/ui';

export function NotFound() {
  return (
    <div className="page">
      <div className="card">
        <Empty icon={<Compass size={32} />} title="Nothing here" action={<Link to="/" className="btn btn-primary btn-sm">Back to dashboard</Link>}>
          This page, product or record doesn’t exist in this game.
        </Empty>
      </div>
    </div>
  );
}
