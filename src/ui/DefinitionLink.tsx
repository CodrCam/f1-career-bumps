import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DefinitionLinkProps {
  definition: string;
  children?: string;
}

export const DefinitionLink = ({
  definition,
  children = 'How this is calculated',
}: DefinitionLinkProps) => (
  <Link className="analysis-definition" to={`/methodology#${definition}`}>
    <BookOpen aria-hidden="true" size={13} />
    {children}
  </Link>
);
