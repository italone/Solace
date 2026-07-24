export interface SFCDescriptor {
  template: string | undefined;
  templateOffset: number | undefined;
  script: string | undefined;
  scriptOffset: number | undefined;
  style: string | undefined;
  styleOffset: number | undefined;
}

export interface SourceLocation {
  offset: number;
  line: number;
  column: number;
}

export type SolaceCompileErrorCode =
  "SFC_MISSING_TEMPLATE" | "SFC_PARSE_ERROR" | "SFC_CODEGEN_ERROR";

export interface SolaceCompileErrorOptions {
  code: SolaceCompileErrorCode;
  message: string;
  filename?: string;
  loc?: SourceLocation;
  cause?: unknown;
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
