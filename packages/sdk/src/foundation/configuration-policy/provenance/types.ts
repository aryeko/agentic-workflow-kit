export type PolicySourceLayer = 'operator-override' | 'profile' | 'built-in-defaults';

export type FieldProvenance = {
  readonly fieldPath: string;
  readonly sourceLayer: PolicySourceLayer;
  readonly profile?: string;
  readonly sourceRef: string;
  readonly valueHash: string;
};
