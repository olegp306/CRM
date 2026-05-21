import rootPackage from "../../../../package.json";

export type AppMetadata = {
  name: string;
  version: string;
};

export const currentAppMetadata: AppMetadata = {
  name: rootPackage.name,
  version: rootPackage.version
};
