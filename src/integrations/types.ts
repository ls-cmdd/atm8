export interface ParamField {
  name: string;
  label: string;
  type: 'string' | 'text' | 'number' | 'boolean' | 'select' | 'json' | 'code';
  required?: boolean;
  defaultValue?: any;
  options?: { label: string; value: string }[];
  placeholder?: string;
  description?: string;
}

export interface NodeDefinition {
  type: string;
  label: string;
  category: 'triggers' | 'actions' | 'logic' | 'ai' | 'communication' | 'storage';
  icon: string;
  description: string;
  paramsSchema: ParamField[];
  outputs?: { name: string; label: string; type: string }[];
}

export interface WorkflowNodeData {
  id: string;
  type: string;
  label?: string;
  params?: Record<string, any>;
  [key: string]: any;
}

export interface ExecutionContext {
  [nodeIdOrKey: string]: any;
}
