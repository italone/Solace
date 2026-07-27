declare module "*.solace" {
  import type { ComponentType } from "@italone/solace";

  const component: ComponentType;
  export default component;
}
