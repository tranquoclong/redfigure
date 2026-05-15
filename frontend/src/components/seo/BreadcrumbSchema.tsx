import { buildBreadcrumbSchema, type BreadcrumbItem } from './schemas';
import { JsonLdScript } from './JsonLdScript';

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
}

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const data = buildBreadcrumbSchema(items);
  return <JsonLdScript data={data} />;
}
