import { buildWebSiteSchema, type WebSiteSchemaOptions } from './schemas';
import { JsonLdScript } from './JsonLdScript';

export function WebSiteSchema(props: WebSiteSchemaOptions) {
  const data = buildWebSiteSchema(props);
  return <JsonLdScript data={data} />;
}
