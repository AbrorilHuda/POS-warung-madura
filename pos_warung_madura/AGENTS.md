# AGENTS.md

## Project Guidelines

Follow these guidelines when working on this project.

---

## 1. Package Manager & Command Execution

This project uses **npm** as the package manager.

### Available Scripts

The project currently provides these npm scripts:

```json
{
  "build": "react-router build",
  "dev": "react-router dev",
  "start": "react-router-serve ./build/server/index.js",
  "typecheck": "react-router typegen && tsc"
}
```

### Command Execution Rules

Always try the normal npm command first:

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm install <name_package>
```

If the command fails because of a Windows shell/environment issue, retry using:

```cmd
cmd /c npm run dev
cmd /c npm run build
cmd /c npm run start
cmd /c npm run typecheck
cmd /c npm install <name_package>
```

### Rules

1. Try the normal command first.
2. If it fails because of Windows shell, PATH, command resolution, or similar environment issues, use `cmd /c`.
3. Apply this fallback to **all npm scripts**, not only `dev`.
4. Do not assume that an npm script is broken just because the first command fails.
5. Check the actual error before changing project configuration.
6. Do not modify `package.json` merely to work around a shell-specific problem.

### General Pattern

Normal:

```bash
npm run <script>
```

Windows fallback:

```cmd
cmd /c npm run <script>
```

---

# 2. Keep the Code Simple

**Do not over-engineer the code.**

Prefer the simplest implementation that correctly solves the current requirement.

### Core Principle

> Solve the problem that exists now, not hypothetical problems that may exist in the future.

### Guidelines

* Prefer simple and readable code.
* Do not introduce unnecessary abstractions.
* Do not create a utility/helper function unless it is actually reused or improves clarity.
* Do not create a new component just to wrap a few lines of code without a clear benefit.
* Do not introduce additional libraries when the existing stack can solve the problem.
* Do not add complex design patterns unless they are genuinely necessary.
* Avoid unnecessary interfaces, factories, adapters, repositories, services, providers, or wrappers.
* Avoid premature optimization.
* Avoid speculative features.
* Avoid adding configuration that is not currently required.
* Reuse existing project patterns and components whenever possible.
* Prefer explicit code over unnecessarily clever code.

### Before Adding Abstraction

Before creating an abstraction, ask:

1. Is this code actually reused?
2. Does the abstraction make the code easier to understand?
3. Does it solve a real current problem?
4. Could the same requirement be solved more simply?

If the answer is mostly **no**, keep the implementation simple.

---

# 3. Avoid Unnecessary Refactoring

When implementing a feature or fixing a bug:

* Change only what is necessary.
* Do not refactor unrelated code.
* Do not rename existing variables/functions without a reason.
* Do not restructure folders without a clear requirement.
* Do not rewrite working code just because another approach looks cleaner.
* Preserve existing behavior unless the requirement explicitly changes it.

A small bug fix should remain a small bug fix.

---

# 4. Reuse Existing Project Patterns

Before creating something new:

1. Inspect the existing implementation.
2. Look for similar components/functions/routes.
3. Follow the project's existing conventions.
4. Reuse existing utilities and components when appropriate.
5. Only introduce a new pattern when the existing pattern cannot reasonably handle the requirement.

Consistency with the existing codebase is preferred over introducing a theoretically "better" architecture.

---

# 5. Dependencies

Do not install a new dependency unless it provides a clear benefit that cannot reasonably be achieved with:

* existing dependencies,
* native browser APIs,
* existing project utilities,
* or a small amount of straightforward code.

Before installing a package, verify that the functionality is actually needed.

---

# 6. Debugging

When something fails:

1. Read the error carefully.
2. Identify the actual root cause.
3. Try the smallest reasonable fix.
4. Verify the fix.
5. Only make broader changes if the simple fix does not work.

Do not respond to a small error by redesigning the entire feature.

---

# 7. Validation

After making changes, use the project's existing scripts when relevant:

```bash
npm run typecheck
npm run build
```

If npm execution fails due to Windows shell issues:

```cmd
cmd /c npm run typecheck
cmd /c npm run build
```

Run only the checks relevant to the changes when possible.

---

# 8. Code Quality

Code should be:

* readable,
* maintainable,
* predictable,
* type-safe where applicable,
* consistent with the existing codebase,
* and as simple as reasonably possible.

### Preferred

```ts
const total = price * quantity;
```

### Avoid unnecessary abstraction

```ts
const calculateTransactionTotal = createCalculationStrategy({
  operation: createMultiplicationOperation(),
});
```

unless the project genuinely requires that level of abstraction.

---

# 9. General Agent Behavior

When working on this project:

* Understand the existing code before changing it.
* Make the smallest change that solves the requirement.
* Prefer simple solutions.
* Reuse existing code.
* Avoid unnecessary dependencies.
* Avoid unnecessary refactoring.
* Avoid premature optimization.
* Verify changes with appropriate checks.
* Follow existing project conventions.
* Do not introduce complexity without a concrete reason.

**Simple, clear, working code is preferred over complex, "enterprise-style" code when both solve the same problem.**
