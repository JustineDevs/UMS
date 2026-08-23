export type ComponentAttribute = { name: string; value: string };

export type ComponentDefinition = {
  type: string;
  name?: string;
  nodes?: readonly string[];
  attributes?: readonly string[] | Readonly<Record<string, string>>;
  classes?: readonly string[];
  classesRegex?: readonly string[];
};

export type MatchableElement = {
  tagName: string;
  attributes?: Iterable<ComponentAttribute>;
};

export class ComponentRegistry {
  private readonly components = new Map<string, ComponentDefinition>();
  private readonly nodes = new Map<string, ComponentDefinition>();
  private readonly attributes = new Map<string, ComponentDefinition | Map<string, ComponentDefinition>>();
  private readonly classes = new Map<string, ComponentDefinition>();
  private readonly classesRegex = new Map<string, ComponentDefinition>();

  register(type: string, definition: Omit<ComponentDefinition, "type">): ComponentDefinition {
    const component = { ...definition, type };
    this.components.set(type, component);
    definition.nodes?.forEach((node) => this.nodes.set(node, component));

    if (Array.isArray(definition.attributes)) {
      definition.attributes.forEach((attribute) => this.attributes.set(attribute, component));
    } else {
      for (const [attribute, value] of Object.entries(definition.attributes ?? {})) {
        const values = this.attributes.get(attribute);
        const lookup = values instanceof Map ? values : new Map<string, ComponentDefinition>();
        lookup.set(value, component);
        this.attributes.set(attribute, lookup);
      }
    }
    definition.classes?.forEach((className) => this.classes.set(className, component));
    definition.classesRegex?.forEach((pattern) => this.classesRegex.set(pattern, component));
    return component;
  }

  get(type: string): ComponentDefinition | undefined { return this.components.get(type); }

  matchNode(node: MatchableElement | null | undefined): ComponentDefinition | undefined {
    if (!node?.tagName) return undefined;
    const attributes = [...(node.attributes ?? [])];

    for (const { name, value } of attributes) {
      const match = this.attributes.get(name);
      if (match instanceof Map) {
        const byValue = match.get(value);
        if (byValue) return byValue;
      } else if (match) {
        return match;
      }
    }

    const classAttribute = attributes.find(({ name }) => name === "class");
    if (classAttribute) {
      for (const className of classAttribute.value.split(" ")) {
        const match = this.classes.get(className);
        if (match) return match;
      }
      for (const [pattern, component] of this.classesRegex) {
        if (new RegExp(pattern).exec(classAttribute.value)) return component;
      }
    }
    return this.nodes.get(node.tagName.toLowerCase());
  }
}
