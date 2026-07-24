export interface SFCDescriptor {
  template: string | undefined;
  script: string | undefined;
  style: string | undefined;
}

export type TemplateNode = ElementNode | TextNode | InterpolationNode;

export interface ElementNode {
  type: "element";
  tag: string;
  attributes: Attribute[];
  children: TemplateNode[];
  isSelfClosing: boolean;
}

export interface TextNode {
  type: "text";
  content: string;
}

export interface InterpolationNode {
  type: "interpolation";
  expression: string;
}

export interface Attribute {
  name: string;
  value: AttributeValue;
}

export type AttributeValue =
  | { type: "static"; content: string }
  | { type: "expression"; content: string }
  | { type: "boolean"; value: boolean };
