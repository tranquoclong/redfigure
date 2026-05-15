import { buildOrganizationSchema, type OrganizationSchemaOptions } from './schemas';
import { JsonLdScript } from './JsonLdScript';

export function OrganizationSchema(props: OrganizationSchemaOptions) {
  const data = buildOrganizationSchema(props);
  return <JsonLdScript data={data} />;
}
