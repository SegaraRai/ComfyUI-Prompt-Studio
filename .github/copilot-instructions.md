# ComfyUI Prompt Studio Development Guidelines

## Web Components with Svelte 5

### Component Creation Fundamentals

#### Web Component Requirements

- **All components must be created as Web Components** and properly loaded
- Use the custom element syntax: `<cps-my-component></cps-my-component>`
- **Never use Svelte's native component syntax** `<MyComponent />` in templates

#### Naming Conventions

- **Component class names**: Use `CPS<ComponentName>` format
  - Examples: `CPSPromptEditor`, `CPSHelpPanel`, `CPSToolbar`
- **Custom element tag names**: Use kebab-case with `cps-` prefix
  - Examples: `cps-prompt-editor`, `cps-help-panel`, `cps-toolbar`

#### Interface Design

- **Define clear TypeScript interfaces** for each component and export them
- **Reference existing components** in the codebase for consistency patterns
- Create separate interfaces for:
  - Component attributes (`CPSMyComponentAttributes`)
  - Element interface (`CPSMyComponentElement extends HTMLElement`)

### Event Handling

#### Event Dispatch Pattern

- **Use `$host().dispatchEvent(new Event(...))`** to dispatch events from components
- **Avoid extracting event handlers from properties**
- **Prefer built-in `Event` class** over `CustomEvent` when possible
- **Use custom element properties** to pass additional data instead of complex event payloads
- **Use `CustomEvent` only for temporary values** that are not persistent in components (e.g., transient state changes, one-time notifications)

#### Example Event Handling

```typescript
// ✅ Preferred: Simple event dispatch
$host().dispatchEvent(new Event("valuechange"));

// ✅ Use properties for data passing
let { value = "" }: { value?: string } = $props();
```

### Type Registration

#### Custom Elements Declaration

**Always update `custom-elements.d.ts`** when:

- Adding new custom elements
- Changing component events
- Modifying component attributes or properties

#### Required Steps

1. **Import component types** in `custom-elements.d.ts`
2. **Declare both `Attributes` and `Element` interfaces**
3. **Extend the `SvelteHTMLElements`, `HTMLElementTagNameMap`, and `HTMLElementEventMap`** interfaces properly

### Complete Implementation Example

```typescript
// In component file: my-component.svelte
// <script module lang="ts"> block
export interface CPSMyComponentAttributes {
  value?: string;
  disabled?: boolean;
}

export interface CPSMyComponentElement extends HTMLElement {
  value: string;
  disabled: boolean;
}

// <script lang="ts"> block
let { value = "", disabled = false }: CPSMyComponentAttributes = $props();

function handleClick() {
  if (!disabled) {
    $host().dispatchEvent(new Event("cps-my-component-click"));
  }
}

// In custom-elements.d.ts
import type {
  CPSMyComponentAttributes,
  CPSMyComponentElement,
} from "./lib/path/my-component.svelte";

declare module "svelte/elements" {
  export interface SvelteHTMLElements {
    "cps-my-component": CPSMyComponentAttributes;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cps-my-component": CPSMyComponentElement;
  }

  interface HTMLElementEventMap {
    "cps-my-component-click": Event;
  }
}
```

## Styling Guidelines

### CSS Framework Usage

- **Use Tailwind CSS v4** and **daisyUI v5** for all styling
- **Prefer `space-x/y-*` utilities or CSS Grid over Flexbox** for layouts
- Maintain consistent spacing and component patterns across the application

### Layout Patterns

```html
<!-- Preferred: Using space utilities -->
<div class="space-x-4">
  <button>Button 1</button>
  <button>Button 2</button>
</div>

<!-- Preferred: Using Grid -->
<div class="grid grid-cols-2 gap-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

<!-- Avoid: Flexbox unless absolutely necessary -->
```

## Svelte 5 Syntax

### Runes Usage

- **Always use Svelte 5's rune syntax** (`$state`, `$derived`, `$effect`, etc.)
- Leverage reactive patterns with runes for state management
- Use `$props()` for component properties
- **Avoid using `$bindable()`** since it is not supported in Web Components

### Example

```typescript
let {
  data,
  disabled = false,
}: {
  data: RequiredData;
  disabled?: boolean;
} = $props();
let count = $state(0);
const doubled = $derived(count * 2);

$effect(() => {
  // Place side effects that can be cleaned up or that can be executed multiple times here.
  // Use atom write hooks for side effects that must not be executed more than twice.
});
```

## User Interface Restrictions

### Prohibited Native Dialogs

- **Never use `alert()`, `confirm()`, or `prompt()`**
- Use the existing toast manager system for notifications
- Create custom modal elements for confirmation dialogs

## Internationalization (i18n)

### Text Management

- **All user-facing text except error messages must be internationalized**
- Message definitions are located in `messages/*.json` files
- Follow the existing key structure and naming conventions

### Workflow

1. Add new messages to `messages/en.json` (and other language files)
2. **Run `pnpm run build` after updating i18n messages** to update type definitions
3. Use the generated types for type-safe message access

### Example

```json
// messages/en.json
{
  "buttons": {
    "save": "Save",
    "cancel": "Cancel"
  }
}
```

## State Management with Jotai Vanilla

### Atom Patterns

#### Atoms with Side Effects

- **Make base atoms private** when they have side effects that cannot be cleaned up if executed multiple times
- **Export derived atoms with write hooks** for public API

```javascript
// Private base atom
const _baseAtom = atom(initialValue);

// Public derived atom with write hook
export const publicAtom = atom(
  (get) => get(_baseAtom),
  (get, set, newValue) => {
    // Handle side effects here
    set(_baseAtom, newValue);
  },
);
```

#### Pure Computations

- **Define derived atoms with only get hooks** for computations without side effects

```javascript
export const derivedAtom = atom((get) => {
  const value = get(baseAtom);
  return computeValue(value);
});
```

#### Component-Level Side Effects

- **Use `$effect` for side effects** that are:
  - Confined to the component
  - Safe to execute multiple times

```javascript
$effect(() => {
  // Component-specific side effects
  return () => {
    // Cleanup if needed
  };
});
```

## Architecture Principles

### Core Independence

- **Core code must not depend on the host application**
- Maintain clear separation between core functionality and application-specific code
- Design components to be reusable and framework-agnostic where possible

### Code Organization

#### Avoid Duplication

- Extract common functionality into shared utilities
- Create reusable components for repeated UI patterns
- Use consistent patterns across similar features

#### Code Collocation

- **Keep related code close together**
- Group components, styles, and tests in logical directories
- Place utility functions near where they're used when possible

### File Structure Guidelines

```text
src/lib/
├── actions/              # Svelte actions for DOM interactions
├── core/                 # Core business logic and algorithms
├── editor/               # Code editor components and extensions
├── entrypoints/          # Application entry points for different environments
├── states/               # Jotai atoms and state management
├── wasm/                 # WebAssembly bindings and utilities
├── widget/               # Prompt Studio widgets and components
├── component-utils.ts    # Utilities for component development
├── factory.ts            # Component factory functions
├── index.ts              # Main library exports
└── toast-manager.svelte  # Global toast notification system
```

## Development Workflow

1. **Before starting**: Review existing components for similar patterns
2. **During development**: Follow the established conventions and patterns
3. **Before committing**: Ensure all guidelines are followed
4. **After i18n changes**: Run `pnpm run build` to update type definitions
5. **Testing**: Verify Web Components work correctly in isolation and integration
6. **Before completing**: Run `pnpm run format` then `pnpm run lint` then `pnpm run test` to ensure code quality

## Quality Standards

- Maintain type safety throughout the codebase
- Write clear, self-documenting code
- Follow consistent naming conventions
- Ensure accessibility standards are met
- Test components in both development and production builds
